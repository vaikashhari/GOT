/**
 * Scroll-scrubbed video engine.
 *
 * Scrubbing a <video> element's currentTime directly is janky and
 * codec-dependent, so this engine converts the video into a sequence of
 * compressed frames at runtime and renders them to a canvas:
 *
 *   1. EXTRACT — one background seek-loop walks the video and captures frames
 *      as WebP blobs. It works in coarse-to-fine passes (every 8th frame,
 *      then 4th, 2nd, all), so the whole timeline becomes scrubbable within
 *      a couple of seconds and sharpens progressively. If the visitor is
 *      already inside the reveal, the loop reprioritizes to capture frames
 *      nearest the playhead first.
 *
 *   2. DECODE — a small LRU window of ImageBitmaps around the playhead is
 *      decoded ahead of need (biased in the scroll direction), keeping memory
 *      flat regardless of video length.
 *
 *   3. DRAW — every tick the playhead eases toward the scroll target
 *      (frame-rate normalized damping) and the nearest captured frame is
 *      cover-drawn. When both neighbouring frames are decoded they are
 *      cross-blended for sub-frame smoothness. The canvas is never cleared
 *      without a redraw, so there is never a black flash — the poster image
 *      paints synchronously at startup.
 */
import { gsap, scrollBusy } from '../core/scroll.js'
import { quality } from '../core/quality.js'

/**
 * fit: 'auto'  — cover on landscape viewports, width-fit with feathered
 *                edges on portrait (right for title/map films).
 *      'cover' — true edge-to-edge cover everywhere, cropping as needed
 *                (the mandate for character chapters: no bars, ever).
 */
export function createScrubber ({ canvas, source, autostart = true, maxFrames = quality.scrubFrames, fit = 'auto' }) {
  const ctx = canvas.getContext('2d', { alpha: true })

  const state = {
    target: 0, // where scroll wants the playhead (0-1), written by timeline
    current: 0, // damped playhead
    ready: false, // metadata loaded, extraction underway
    done: false, // all frames captured
    captured: 0, // frames captured so far (diagnostics)
    near: true, // within a viewport or two of its chapter
  }

  let frameCount = 0
  let duration = 0
  let videoW = 16
  let videoH = 9
  let captureW = 0
  let captureH = 0

  const blobs = [] // index -> Blob
  const bitmaps = new Map() // index -> ImageBitmap (LRU window)
  const decoding = new Set()
  let capturedCount = 0
  let lastDrawnKey = -1
  let poster = null
  let posterDrawn = false
  let dpr = quality.dpr

  // --- canvas sizing -------------------------------------------------------

  function resize () {
    dpr = quality.dpr
    canvas.width = Math.round(canvas.clientWidth * dpr)
    canvas.height = Math.round(canvas.clientHeight * dpr)
    lastDrawnKey = -1 // force redraw at new size
    // resizing clears the canvas — repaint the poster if no frame is decoded
    // yet so there is never a blank flash
    if (poster && (!state.ready || bitmaps.size === 0)) drawSource(poster)
  }

  /**
   * Cover-fit draw (crops edges like background-size: cover). On clearly
   * portrait viewports a 16:9 title would lose its wings to the crop, so we
   * fit by width instead and feather the film's top/bottom edges into
   * transparency — the living atmosphere fills the rest of the frame.
   */
  function drawSource (img, alpha = 1) {
    const cw = canvas.width
    const ch = canvas.height
    const iw = img.width || videoW
    const ih = img.height || videoH
    const portrait = fit === 'auto' && cw / ch < 0.92
    const scale = portrait ? cw / iw : Math.max(cw / iw, ch / ih)
    const dw = iw * scale
    const dh = ih * scale
    const dx = (cw - dw) / 2
    const dy = (ch - dh) / 2
    ctx.globalAlpha = alpha
    if (!portrait) {
      ctx.drawImage(img, dx, dy, dw, dh)
      ctx.globalAlpha = 1
      return
    }
    if (alpha === 1) ctx.clearRect(0, 0, cw, ch)
    ctx.drawImage(img, dx, dy, dw, dh)
    ctx.globalAlpha = 1
    const feather = dh * 0.2
    ctx.globalCompositeOperation = 'destination-out'
    let g = ctx.createLinearGradient(0, dy, 0, dy + feather)
    g.addColorStop(0, 'rgba(0,0,0,1)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, dy - 1, cw, feather + 1)
    g = ctx.createLinearGradient(0, dy + dh - feather, 0, dy + dh)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(0,0,0,1)')
    ctx.fillStyle = g
    ctx.fillRect(0, dy + dh - feather, cw, feather + 1)
    ctx.globalCompositeOperation = 'source-over'
  }

  // --- extraction ----------------------------------------------------------

  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  // deferred chapters only fetch metadata until their extraction actually
  // starts — four films buffering at boot would drown the opening scenes
  video.preload = autostart ? 'auto' : 'metadata'
  // R2-hosted chapter videos are cross-origin and are drawn into canvas.
  // Request CORS-enabled media so canvas frame extraction is not tainted.
  if (source.src && /^https?:\/\//.test(source.src) && !source.src.startsWith(location.origin)) {
    video.crossOrigin = 'anonymous'
  }
  video.src = source.src

  // Some mobile browsers only allow seek+draw after a gesture "unlocks" the
  // element. Scrolling counts; this is belt and braces.
  const unlock = () => {
    video.play().then(() => video.pause()).catch(() => {})
    removeEventListener('touchstart', unlock)
    removeEventListener('pointerdown', unlock)
  }
  addEventListener('touchstart', unlock, { once: true, passive: true })
  addEventListener('pointerdown', unlock, { once: true })

  const supportsWebP = document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp')
  const blobType = supportsWebP ? 'image/webp' : 'image/jpeg'
  const blobQuality = supportsWebP ? 0.8 : 0.85

  let work = null // offscreen capture canvas
  let workCtx = null

  const seeked = () => new Promise(res => video.addEventListener('seeked', res, { once: true }))

  async function captureFrame (index) {
    const t = duration * (index / (frameCount - 1))
    // Nudge inside the stream: exactly 0 or duration can stall some decoders
    video.currentTime = Math.min(Math.max(t, 0.001), duration - 0.034)
    await seeked()
    workCtx.drawImage(video, 0, 0, captureW, captureH)
    const blob = work.convertToBlob
      ? await work.convertToBlob({ type: blobType, quality: blobQuality })
      : await new Promise(res => work.toBlob(res, blobType, blobQuality))
    if (blob) {
      blobs[index] = blob
      capturedCount++
    }
    return blob
  }

  /**
   * Pick the next frame to capture. Idle: coarse-to-fine strides for even
   * coverage. Active (visitor near the reveal): nearest uncaptured frame to
   * the playhead, so the picture sharpens exactly where they are looking.
   */
  let active = false
  const STRIDES = [8, 4, 2, 1]

  function pickNext () {
    if (capturedCount >= frameCount) return -1
    if (active) {
      const center = Math.round(state.target * (frameCount - 1))
      let best = -1
      let bestDist = Infinity
      for (let i = 0; i < frameCount; i++) {
        if (blobs[i]) continue
        const d = Math.abs(i - center)
        if (d < bestDist) { bestDist = d; best = i }
      }
      return best
    }
    for (const stride of STRIDES) {
      for (let i = 0; i < frameCount; i += stride) {
        if (!blobs[i]) return i
      }
    }
    return -1
  }

  async function extractLoop () {
    await new Promise(res => {
      if (video.readyState >= 1) res()
      else video.addEventListener('loadedmetadata', res, { once: true })
    })

    duration = video.duration
    videoW = video.videoWidth
    videoH = video.videoHeight
    const aspect = videoW / videoH
    captureW = Math.min(quality.scrubWidth, videoW)
    captureH = Math.round(captureW / aspect / 2) * 2
    // safety for unusual aspects (very tall/wide sources): keep each frame
    // within the tier's pixel budget so bitmap memory stays flat
    const budget = quality.scrubWidth * quality.scrubWidth * 0.5625
    if (captureW * captureH > budget) {
      const s = Math.sqrt(budget / (captureW * captureH))
      captureW = Math.round(captureW * s / 2) * 2
      captureH = Math.round(captureH * s / 2) * 2
    }

    const fpsBudget = Math.round(duration * 20) // ~20 samples/s is plenty for scrub
    frameCount = Math.max(48, Math.min(maxFrames, fpsBudget))
    blobs.length = frameCount

    work = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(captureW, captureH)
      : Object.assign(document.createElement('canvas'), { width: captureW, height: captureH })
    workCtx = work.getContext('2d', { alpha: false })

    state.ready = true

    const sleep = ms => new Promise(r => setTimeout(r, ms))
    let failures = 0
    while (true) {
      // The scroll thread always wins: while the visitor is scrolling and
      // this film isn't the one on screen, extraction waits. When it IS on
      // screen it keeps working (the picture needs it) but gently.
      while (scrollBusy() && !active) await sleep(140)
      if (scrollBusy() && active) await sleep(50)

      const next = pickNext()
      if (next === -1) break
      try {
        await captureFrame(next)
        state.captured = capturedCount
      } catch {
        if (++failures > 12) break // codec trouble — poster/fallback still shown
        await sleep(150)
      }
    }
    state.done = capturedCount >= frameCount * 0.9
  }

  // --- decode window -------------------------------------------------------

  let lastTarget = 0

  function ensureDecoded (index) {
    if (index < 0 || index >= frameCount) return
    if (bitmaps.has(index) || decoding.has(index) || !blobs[index]) return
    if (decoding.size >= 3) return
    decoding.add(index)
    createImageBitmap(blobs[index])
      .then(bmp => {
        bitmaps.set(index, bmp)
        evict(index)
      })
      .catch(() => {})
      .finally(() => decoding.delete(index))
  }

  function evict (center) {
    if (bitmaps.size <= quality.decodeWindow) return
    let worst = -1
    let worstDist = -1
    for (const key of bitmaps.keys()) {
      const d = Math.abs(key - center)
      if (d > worstDist) { worstDist = d; worst = key }
    }
    if (worst !== -1) {
      bitmaps.get(worst).close?.()
      bitmaps.delete(worst)
    }
  }

  function prefetch (center, dir) {
    const half = Math.floor(quality.decodeWindow / 2)
    ensureDecoded(center)
    for (let off = 1; off <= half; off++) {
      ensureDecoded(center + off * (dir >= 0 ? 1 : -1))
      if (off <= half / 2) ensureDecoded(center - off * (dir >= 0 ? 1 : -1))
    }
  }

  /** Nearest decoded frame to `index` (searching both directions). */
  function nearestDecoded (index) {
    if (bitmaps.has(index)) return { bmp: bitmaps.get(index), at: index }
    for (let off = 1; off < frameCount; off++) {
      if (bitmaps.has(index - off)) return { bmp: bitmaps.get(index - off), at: index - off }
      if (bitmaps.has(index + off)) return { bmp: bitmaps.get(index + off), at: index + off }
    }
    return null
  }

  // --- render --------------------------------------------------------------

  function render (_t, deltaMs, frame) {
    if (!posterDrawn && poster) {
      drawSource(poster)
      posterDrawn = true
    }
    // far from its chapter: the canvas holds its last frame, zero work
    if (!state.near) return
    if (!state.ready || frameCount < 2) return

    // Frame-rate-normalized damping: identical feel at 60Hz and 144Hz.
    const k = 1 - Math.pow(1 - 0.16, deltaMs / 16.7)
    state.current += (state.target - state.current) * k
    if (Math.abs(state.target - state.current) < 0.0004) state.current = state.target

    const dir = state.target - lastTarget
    lastTarget = state.target

    const exact = state.current * (frameCount - 1)
    const i0 = Math.floor(exact)
    const i1 = Math.min(i0 + 1, frameCount - 1)
    const frac = exact - i0

    prefetch(Math.round(exact), dir)

    const canBlend = quality.blend && bitmaps.has(i0) && bitmaps.has(i1) && i0 !== i1
    const drawKey = canBlend ? exact : (nearestDecoded(Math.round(exact))?.at ?? -1)
    if (drawKey === lastDrawnKey) return // nothing changed — skip the draw
    if (canBlend) {
      drawSource(bitmaps.get(i0))
      if (frac > 0.02) drawSource(bitmaps.get(i1), frac)
      lastDrawnKey = exact
    } else {
      const near = nearestDecoded(Math.round(exact))
      if (near) {
        drawSource(near.bmp)
        lastDrawnKey = near.at
      }
    }
  }

  // --- boot ----------------------------------------------------------------

  if (source.poster) {
    const img = new Image()
    img.onload = () => { poster = img; posterDrawn = false }
    img.src = source.poster
  }

  let startedExtraction = false
  function start () {
    if (startedExtraction) return
    startedExtraction = true
    video.preload = 'auto'
    extractLoop()
  }

  resize()
  window.addEventListener('resize', resize)
  if (autostart) start()
  gsap.ticker.add(render)

  return {
    state,
    /** Begin frame extraction (no-op if already started). */
    start,
    /** Called by the master timeline when the visitor nears/leaves the reveal. */
    setActive (value) { active = value },
    /** Called when the visitor comes within reach of this film's chapter. */
    setNear (value) { state.near = value },
    resize,
    destroy () {
      gsap.ticker.remove(render)
      window.removeEventListener('resize', resize)
      for (const bmp of bitmaps.values()) bmp.close?.()
      bitmaps.clear()
    },
  }
}
