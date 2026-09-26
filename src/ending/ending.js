/**
 * The Final Ending Sequence — the movie ending of the whole experience.
 *
 * Unlike the chapters, this is not scroll-scrubbed: when the visitor
 * arrives, a timed cinematic plays. The backdrop film breathes for a
 * moment; the title rises out of the mist in metallic Roman lettering;
 * the screen falls to black; silence; a dragon roar — and fire takes the
 * darkness; the flames settle, and everything fades to black. End.
 *
 * Asset-driven, like everything else:
 *   assets/ending/<any video>       -> the backdrop film (looped, muted)
 *   assets/ending/dragon.<video>    -> the fire reveal film (optional —
 *                                      a procedural fire burst plays
 *                                      until one is dropped)
 *   assets/ending/<any audio>       -> the roar, synchronized to the fire
 *
 * Scrolling away resets the sequence; returning replays it. The reel is
 * always ready to run again.
 */
import { gsap, ScrollTrigger, scrollTo } from '../core/scroll.js'
import { reducedMotion } from '../core/quality.js'
import { assets } from '../core/assets.js'
import { site } from '../config/site.config.js'
import { createFirefield } from '../fx/fire.js'

export function buildEnding () {
  const section = document.getElementById('ending')
  const video = section.querySelector('.ending-video')
  const dragonVideo = section.querySelector('.ending-dragon')
  const fireCanvas = section.querySelector('.ending-fire-canvas')
  const flash = section.querySelector('.ending-flash')
  const veil = section.querySelector('.ending-veil')
  const title = section.querySelector('.ending-title')
  const backLink = section.querySelector('.ending-return')

  const cfg = site.ending
  title.textContent = cfg.title
  backLink.textContent = cfg.returnLabel
  backLink.addEventListener('click', (e) => {
    e.preventDefault()
    scrollTo(0, { duration: 3 })
  })

  // ---- assets --------------------------------------------------------------
  if (assets.endingVideo) {
    video.src = assets.endingVideo.src
    if (assets.endingVideo.poster) video.poster = assets.endingVideo.poster
  } else {
    video.remove()
    if (import.meta.env.DEV) console.info('[ending] no video in assets/ending/ yet — the finale plays over darkness until one is dropped.')
  }

  let hasDragon = false
  if (assets.endingDragon) {
    dragonVideo.src = assets.endingDragon.src
    hasDragon = true
  } else {
    dragonVideo.remove()
  }

  let roar = null
  if (assets.endingRoar) {
    roar = new Audio(assets.endingRoar.src)
    roar.preload = 'auto'
    roar.volume = 0.75
  }

  // ---- reduced motion: a still, the title, the way home --------------------
  if (reducedMotion) {
    if (video.isConnected) { video.autoplay = false; video.removeAttribute('src'); video.load?.() }
    if (assets.endingVideo?.still || assets.endingVideo?.poster) {
      const img = new Image()
      img.className = 'reduced-still'
      img.alt = ''
      img.src = assets.endingVideo.still || assets.endingVideo.poster
      section.querySelector('.ending-viewport').prepend(img)
    }
    gsap.set(veil, { opacity: 0.45 })
    gsap.set(title, { opacity: 1, y: 0 })
    gsap.set(backLink, { opacity: 0.75, pointerEvents: 'auto' })
    return
  }

  // ---- the fire ------------------------------------------------------------
  const blaze = { embers: 0, sparks: 0, ash: 0, smoke: 0, heat: 1, burst: 0 }
  const firefield = createFirefield(fireCanvas, blaze)
  firefield.setVisible(false)

  // ---- the cinematic -------------------------------------------------------
  const t = cfg.timings
  let played = false

  const tl = gsap.timeline({ paused: true })

  // arrival: the mist breathes
  tl.add(() => {
    if (video.isConnected) {
      video.currentTime = 0
      video.play().catch(() => {})
    }
    firefield.setVisible(true)
  }, 0)
  tl.to(veil, { opacity: 0, duration: 1.1, ease: 'sine.out' }, 0.05)

  // the title rises out of the mist
  tl.fromTo(title,
    { opacity: 0, y: 46, letterSpacing: '0.5em', filter: 'blur(12px)' },
    { opacity: 1, y: 0, letterSpacing: '0.3em', filter: 'blur(0px)', duration: t.titleReveal, ease: 'power2.out' },
    t.absorb)

  // pause… then the world falls to black
  const blackAt = t.absorb + t.titleReveal + t.titleHold
  tl.to(veil, { opacity: 1, duration: t.fadeToBlack, ease: 'sine.inOut' }, blackAt)
  tl.to(title, { opacity: 0, filter: 'blur(8px)', duration: t.fadeToBlack * 0.85, ease: 'sine.in' }, blackAt + 0.15)
  tl.add(() => { if (video.isConnected) video.pause() }, blackAt + t.fadeToBlack + 0.1)

  // silence — then the roar, and fire takes the darkness
  const fireAt = blackAt + t.fadeToBlack + t.silence
  tl.add(() => {
    roar?.play().catch(() => {})
    if (hasDragon && dragonVideo.isConnected) {
      dragonVideo.currentTime = 0
      dragonVideo.play().catch(() => {})
    }
  }, fireAt)

  if (hasDragon) {
    tl.to(dragonVideo, { opacity: 1, duration: 0.4, ease: 'power2.out' }, fireAt + 0.05)
    tl.to(dragonVideo, { opacity: 0, duration: t.settle, ease: 'sine.inOut' }, fireAt + t.fire)
  } else {
    // procedural fire: a violent bloom of embers, sparks and light
    tl.to(blaze, { burst: 1, embers: 1, sparks: 1, smoke: 0.55, duration: 0.45, ease: 'power3.out' }, fireAt + 0.05)
    tl.to(flash, { opacity: 0.9, duration: 0.3, ease: 'power3.out' }, fireAt + 0.08)
    tl.to(flash, { opacity: 0.35, duration: 0.5, ease: 'sine.inOut' }, fireAt + 0.45)
    tl.to(flash, { opacity: 0.7, duration: 0.4, ease: 'sine.inOut' }, fireAt + 1.1)
    tl.to(flash, { opacity: 0, duration: t.settle, ease: 'sine.in' }, fireAt + t.fire - 0.4)
    tl.to(blaze, { burst: 0, embers: 0.25, sparks: 0, smoke: 0.15, duration: t.settle, ease: 'sine.inOut' }, fireAt + t.fire)
  }

  // the flames settle; everything returns to darkness
  const endAt = fireAt + t.fire + t.settle
  tl.to(blaze, { embers: 0, smoke: 0, duration: t.finalFade, ease: 'sine.in' }, endAt)
  tl.to(fireCanvas, { opacity: 0, duration: t.finalFade, ease: 'sine.in' }, endAt)

  // …end. and, quietly, the way back to the beginning
  tl.to(backLink, { opacity: 0.75, pointerEvents: 'auto', duration: 1.6, ease: 'sine.out' }, endAt + t.finalFade + 1.1)

  const reset = () => {
    played = false
    tl.pause(0)
    if (video.isConnected) { video.pause(); video.currentTime = 0 }
    if (hasDragon && dragonVideo.isConnected) { dragonVideo.pause(); gsap.set(dragonVideo, { opacity: 0 }) }
    Object.assign(blaze, { embers: 0, sparks: 0, smoke: 0, burst: 0 })
    firefield.setVisible(false)
    gsap.set(veil, { opacity: 1 })
    gsap.set(title, { opacity: 0 })
    gsap.set(flash, { opacity: 0 })
    gsap.set(fireCanvas, { opacity: 1 })
    gsap.set(backLink, { opacity: 0, pointerEvents: 'none' })
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top 12%',
    onEnter: () => {
      if (played) reset()
      played = true
      tl.play(0)
    },
  })
  ScrollTrigger.create({
    trigger: section,
    start: 'top 96%',
    onLeaveBack: () => reset(),
  })
}
