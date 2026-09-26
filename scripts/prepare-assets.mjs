/**
 * Asset preparation pipeline.
 *
 * Scans /assets and produces web-optimized derivatives in /assets/.web:
 *   - Videos  -> H.264 MP4 (universal decode, short GOP for frame-accurate
 *                scrubbing), plus first/last frame stills (webp).
 *   - Images  -> resized/compressed webp when the source is heavy.
 *   - Audio   -> AAC (m4a) when the source is uncompressed.
 *
 * Results are recorded in /assets/.web/manifest.json keyed by the source's
 * relative path. Unchanged sources (same size + mtime) are skipped, so this
 * is cheap to run on every `npm run dev` / `npm run build`.
 *
 * Drop any file into assets/<role>/ and re-run (the dev server does this
 * automatically) — no code changes required anywhere else.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, existsSync, rmSync, copyFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ASSETS = path.join(ROOT, 'assets')
const OUT = path.join(ASSETS, '.web')
const MANIFEST_PATH = path.join(OUT, 'manifest.json')

const VIDEO_EXT = new Set(['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv'])
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp'])
const AUDIO_EXT = new Set(['.wav', '.aiff', '.aif', '.flac', '.mp3', '.m4a', '.aac', '.ogg'])

const MAX_VIDEO_WIDTH = 1920
const MAX_IMAGE_WIDTH = 2560
const IMAGE_BYTES_THRESHOLD = 450 * 1024

// ---------------------------------------------------------------------------

function which (bin) {
  const probe = spawnSync(bin, ['-version'], { stdio: 'ignore' })
  return probe.status === 0 || probe.status === 1
}

function run (bin, args, attempt = 0) {
  const res = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (res.status !== 0) {
    // transient file locks (OneDrive sync, antivirus) deserve one retry
    if (attempt < 1) {
      spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},1500)']) // portable sleep
      return run(bin, args, attempt + 1)
    }
    throw new Error(`${bin} ${args.join(' ')}\n${res.stderr || res.stdout || 'unknown error'}`)
  }
  return res.stdout
}

function probe (file) {
  const json = run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration,size,bit_rate:stream=codec_name,codec_type,width,height,r_frame_rate,nb_frames',
    '-of', 'json', file,
  ])
  const data = JSON.parse(json)
  const video = (data.streams || []).find(s => s.codec_type === 'video')
  const audio = (data.streams || []).find(s => s.codec_type === 'audio')
  const fps = video?.r_frame_rate?.includes('/')
    ? (() => { const [n, d] = video.r_frame_rate.split('/').map(Number); return d ? n / d : 0 })()
    : Number(video?.r_frame_rate || 0)
  return {
    duration: Number(data.format?.duration || 0),
    bitrate: Number(data.format?.bit_rate || 0),
    codec: video?.codec_name || null,
    width: video?.width || 0,
    height: video?.height || 0,
    fps,
    frames: Number(video?.nb_frames || 0) || null,
    hasAudio: Boolean(audio),
  }
}

function walk (dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue // skips .web, dotfiles, OneDrive temp
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else files.push(full)
  }
  return files
}

function rel (file) {
  return path.relative(ASSETS, file).split(path.sep).join('/')
}

function outPathFor (srcRel, suffix) {
  const dir = path.dirname(srcRel)
  const base = path.basename(srcRel, path.extname(srcRel))
  const target = path.join(OUT, dir === '.' ? '' : dir, `${base}${suffix}`)
  mkdirSync(path.dirname(target), { recursive: true })
  return target
}

function srcHash (file) {
  const st = statSync(file)
  return `${st.size}:${Math.round(st.mtimeMs)}`
}

// ---------------------------------------------------------------------------

/**
 * Detect static letterbox/pillarbox bars (e.g. landscape footage exported
 * inside a vertical phone canvas) by sampling cropdetect at several bright
 * points and taking the union of the detected content boxes. Returns an
 * ffmpeg crop string, or null when the frame is already mostly content.
 */
function detectContentCrop (file, info) {
  if (!info.duration || !info.width || !info.height) return null
  const boxes = []
  for (const frac of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    try {
      const out = spawnSync('ffmpeg', [
        '-ss', String(Math.max(info.duration * frac, 0.5)),
        '-i', file,
        '-vf', 'cropdetect=24:2:0',
        '-frames:v', '30', '-f', 'null', '-',
      ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).stderr || ''
      const matches = [...out.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)]
      if (matches.length) {
        const [, w, h, x, y] = matches[matches.length - 1].map(Number)
        if (w > 0 && h > 0) boxes.push({ w, h, x, y })
      }
    } catch { /* sampling failure just means no crop */ }
  }
  if (!boxes.length) return null
  // union of all sampled content boxes, so dark scenes can't over-crop
  const left = Math.min(...boxes.map(b => b.x))
  const top = Math.min(...boxes.map(b => b.y))
  const right = Math.max(...boxes.map(b => b.x + b.w))
  const bottom = Math.max(...boxes.map(b => b.y + b.h))

  // Bars are only ever a letterbox (rows) or a pillarbox (columns), so crop
  // along a single axis. Free-form boxes are how dark footage gets butchered
  // (dim edges read as "bar" and the crop collapses onto the brightest spot).
  const W = info.width
  const H = info.height
  const evenFloor = n => Math.floor(n / 2) * 2
  const candidates = [
    { w: W, h: evenFloor(bottom - top), x: 0, y: top }, // letterbox
    { w: evenFloor(right - left), h: H, x: left, y: 0 }, // pillarbox
  ].filter(c =>
    c.w > 0 && c.h > 0 &&
    c.w * c.h >= W * H * 0.2 && // never keep less than 20% — that's butchery
    c.w * c.h <= W * H * 0.92 // only crop when real bars are removed (>8%)
  )
  if (!candidates.length) return null
  const best = candidates.sort((a, b) => a.w * a.h - b.w * b.h)[0]
  return `crop=${best.w}:${best.h}:${best.x}:${best.y}`
}

function processVideo (file, srcRel, meta) {
  const entry = { kind: 'video', src: srcRel, meta: {} }
  const info = probe(file)
  entry.meta = {
    duration: info.duration,
    fps: info.fps,
    frames: info.frames,
  }

  // Letterboxed sources (e.g. landscape footage inside a vertical phone
  // canvas) are cropped to their real content so every chapter can cover
  // the viewport edge-to-edge without dead bars.
  const contentCrop = detectContentCrop(file, info)
  if (contentCrop) console.log(`\n[assets]   ${srcRel}: trimming static bars (${contentCrop}) ...`)

  const needsTranscode =
    contentCrop !== null ||
    info.codec !== 'h264' ||
    path.extname(file).toLowerCase() !== '.mp4' ||
    info.bitrate > 9_000_000 ||
    info.width > MAX_VIDEO_WIDTH

  // A .web derivative is always produced (production builds reference only
  // derivatives — raw sources never ship). Web-friendly sources are remuxed
  // without re-encoding, which costs milliseconds.
  const out = outPathFor(srcRel, '.web.mp4')
  if (needsTranscode) {
    const filters = [contentCrop, `scale='min(${MAX_VIDEO_WIDTH},iw)':-2`].filter(Boolean).join(',')
    // Short GOP (12) => every frame is at most 11 frames from a keyframe,
    // which keeps currentTime-seeking fast and frame extraction accurate.
    run('ffmpeg', [
      '-y', '-i', file,
      '-an',
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '19',
      '-profile:v', 'high',
      '-pix_fmt', 'yuv420p',
      '-g', '12', '-keyint_min', '12', '-sc_threshold', '0',
      '-vf', filters,
      '-movflags', '+faststart',
      out,
    ])
  } else {
    run('ffmpeg', ['-y', '-i', file, '-an', '-c', 'copy', '-movflags', '+faststart', out])
  }
  const optimized = probe(out)
  entry.out = rel(out)
  entry.meta.width = optimized.width
  entry.meta.height = optimized.height
  entry.meta.bytes = statSync(out).size

  const playable = out

  // First + last frame stills: used as an instant poster while frames decode
  // and as the static fallback for prefers-reduced-motion.
  const poster = outPathFor(srcRel, '.poster.webp')
  run('ffmpeg', ['-y', '-i', playable, '-frames:v', '1', '-vf', `scale='min(${MAX_VIDEO_WIDTH},iw)':-2`, '-quality', '82', poster])
  entry.poster = rel(poster)

  // The "hero frame" of the video — late enough to show the final
  // composition (the title), early enough to dodge any fade-to-black tail.
  const stillAt = Math.max(info.duration * 0.85, info.duration - 1.5).toFixed(3)
  const still = outPathFor(srcRel, '.final.webp')
  run('ffmpeg', ['-y', '-ss', stillAt, '-i', playable, '-frames:v', '1', '-vf', `scale='min(${MAX_VIDEO_WIDTH},iw)':-2`, '-quality', '82', still])
  entry.still = rel(still)

  return entry
}

function processImage (file, srcRel) {
  const entry = { kind: 'image', src: srcRel, meta: {} }
  const info = probe(file)
  entry.meta = { width: info.width, height: info.height }
  const bytes = statSync(file).size

  if (info.width > MAX_IMAGE_WIDTH || bytes > IMAGE_BYTES_THRESHOLD) {
    const out = outPathFor(srcRel, '.web.webp')
    run('ffmpeg', ['-y', '-i', file, '-vf', `scale='min(${MAX_IMAGE_WIDTH},iw)':-2`, '-quality', '82', out])
    entry.out = rel(out)
    const optimized = probe(out)
    entry.meta.width = optimized.width
    entry.meta.height = optimized.height
    entry.meta.bytes = statSync(out).size
  } else {
    entry.out = srcRel
    entry.meta.bytes = bytes
  }
  return entry
}

function processAudio (file, srcRel) {
  const entry = { kind: 'audio', src: srcRel, meta: {} }
  const ext = path.extname(file).toLowerCase()
  const compressed = ['.mp3', '.m4a', '.aac', '.ogg'].includes(ext)
  const out = outPathFor(srcRel, compressed ? `.web${ext}` : '.web.m4a')
  if (compressed) copyFileSync(file, out)
  else run('ffmpeg', ['-y', '-i', file, '-vn', '-c:a', 'aac', '-b:a', '160k', out])
  entry.out = rel(out)
  entry.meta.bytes = statSync(out).size
  return entry
}

// ---------------------------------------------------------------------------

function main () {
  if (!existsSync(ASSETS)) {
    console.log('[assets] no assets directory, nothing to do')
    return
  }

  mkdirSync(OUT, { recursive: true })

  // Only one pipeline instance may run at a time — a second (e.g. the dev
  // server's watcher racing a manual run) would write the same output files
  // concurrently and corrupt them.
  const LOCK = path.join(OUT, '.lock')
  if (existsSync(LOCK)) {
    const age = Date.now() - statSync(LOCK).mtimeMs
    if (age < 10 * 60 * 1000) {
      console.log('[assets] another run is in progress — skipping (it will pick up all pending work)')
      return
    }
    rmSync(LOCK) // stale lock from a crashed run
  }
  writeFileSync(LOCK, String(process.pid))
  const releaseLock = () => { try { rmSync(LOCK) } catch {} }
  process.on('exit', releaseLock)
  process.on('SIGINT', () => { releaseLock(); process.exit(130) })

  let manifest = {}
  if (existsSync(MANIFEST_PATH)) {
    try { manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) } catch { manifest = {} }
  }

  const hasFfmpeg = which('ffmpeg') && which('ffprobe')
  if (!hasFfmpeg) {
    console.warn('[assets] ffmpeg not found — raw assets will be used as-is (videos may not decode in all browsers).')
    console.warn('[assets] install ffmpeg (winget install Gyan.FFmpeg) for automatic optimization.')
    return
  }

  const files = walk(ASSETS)
  const seen = new Set()
  let processed = 0
  let skipped = 0

  for (const file of files) {
    const ext = path.extname(file).toLowerCase()
    const srcRel = rel(file)
    const kind = VIDEO_EXT.has(ext) ? 'video' : IMAGE_EXT.has(ext) ? 'image' : AUDIO_EXT.has(ext) ? 'audio' : null
    if (!kind) continue

    seen.add(srcRel)
    const hash = srcHash(file)
    const prior = manifest[srcRel]
    const outputsIntact = prior && [prior.out, prior.poster, prior.still]
      .filter(Boolean)
      .every(ref => existsSync(path.join(ASSETS, ...ref.split('/'))))
    if (prior?.srcHash === hash && outputsIntact) { skipped++; continue }

    process.stdout.write(`[assets] ${kind}: ${srcRel} ... `)
    try {
      const started = Date.now()
      const entry = kind === 'video' ? processVideo(file, srcRel)
        : kind === 'image' ? processImage(file, srcRel)
        : processAudio(file, srcRel)
      entry.srcHash = hash
      manifest[srcRel] = entry
      processed++
      const kb = entry.meta.bytes ? ` -> ${(entry.meta.bytes / 1024 / 1024).toFixed(1)}MB` : ''
      console.log(`done in ${((Date.now() - started) / 1000).toFixed(1)}s${kb}`)
    } catch (err) {
      console.log('FAILED')
      const msg = String(err.message || err)
      // the command line first, then the tail of stderr where the error lives
      console.error(msg.split('\n')[0])
      console.error(msg.slice(-600))
    }
  }

  // Drop manifest entries (and their derivatives) for deleted sources.
  for (const key of Object.keys(manifest)) {
    if (seen.has(key)) continue
    const entry = manifest[key]
    for (const ref of [entry.out, entry.poster, entry.still]) {
      if (!ref || ref === entry.src) continue
      const full = path.join(ASSETS, ...ref.split('/'))
      if (full.startsWith(OUT) && existsSync(full)) rmSync(full)
    }
    delete manifest[key]
  }

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
  console.log(`[assets] ready — ${processed} processed, ${skipped} up to date`)
}

main()
