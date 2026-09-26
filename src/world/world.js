/**
 * The World Introduction — the first chapter beyond the portal.
 *
 * A sticky full-viewport stage inside a long scroll runway: the world video
 * (assets/world/) is scroll-scrubbed exactly like the prologue's title
 * reveal, wrapped in darkness that lifts on arrival, with whispered
 * captions pacing the journey. Until a video is dropped into assets/world/
 * the chapter breathes as pure atmosphere and still works end-to-end.
 */
import { gsap, ScrollTrigger, createRangeGate } from '../core/scroll.js'
import { quality, reducedMotion } from '../core/quality.js'
import { assets } from '../core/assets.js'
import { site } from '../config/site.config.js'
import { chapterRunwayVh } from '../core/pacing.js'
import { createScrubber } from '../scrub/scrubber.js'

export function buildWorld ({ introScrubber } = {}) {
  const section = document.getElementById('world')
  const viewport = section.querySelector('.world-viewport')
  const canvas = document.getElementById('world-canvas')
  const veil = section.querySelector('.world-veil')
  const kicker = section.querySelector('.world-kicker')
  const captionHost = section.querySelector('.world-captions')

  // ---- copy & pacing from config ------------------------------------------
  // runway follows the film's duration so every chapter scrubs at the
  // same felt speed (the scrub occupies 0.86 of this chapter)
  const fallbackVh = (quality.tier === 'mobile' || quality.tier === 'low')
    ? site.world.lengthVhMobile
    : site.world.lengthVh
  const lengthVh = reducedMotion
    ? site.world.lengthVhReduced
    : chapterRunwayVh(assets.worldVideo?.meta, 0.86, fallbackVh)
  section.style.height = `${lengthVh}vh`

  kicker.textContent = site.world.kicker
  const captionEls = site.world.captions.map(text => {
    const p = document.createElement('p')
    p.className = 'world-caption'
    p.setAttribute('aria-hidden', 'true')
    p.textContent = text
    captionHost.appendChild(p)
    return p
  })

  // ---- the scrubbed film ---------------------------------------------------
  let scrubber = null
  if (assets.worldVideo) {
    // the world journey is long — give it a deeper frame budget so slow
    // travel stays perfectly fluid
    scrubber = createScrubber({
      canvas,
      source: assets.worldVideo,
      autostart: false,
      maxFrames: quality.longScrubFrames,
    })

    // Start frame extraction only when the intro's extraction has finished
    // (or was never created), so the two never fight for the media pipeline.
    const readyToStart = () => !introScrubber || introScrubber.state.done
    const poll = setInterval(() => {
      if (readyToStart()) { scrubber.start(); clearInterval(poll) }
    }, 800)
    // …but the moment the visitor nears the world, start regardless.
    ScrollTrigger.create({
      trigger: section,
      start: 'top 220%',
      once: true,
      onEnter: () => { scrubber.start(); clearInterval(poll) },
    })
    // and far from the chapter, its render loop sleeps entirely
    createRangeGate(
      { trigger: section, start: 'top 140%', end: 'bottom -40%' },
      near => scrubber.setNear(near),
    )
  } else if (import.meta.env.DEV) {
    console.info('[world] no video in assets/world/ yet — the chapter runs as pure atmosphere until one is dropped.')
  }

  // expose for the portal: force extraction to begin at the crossing
  const wake = () => scrubber?.start()

  // ---- choreography --------------------------------------------------------
  if (reducedMotion) {
    if (assets.worldVideo?.still) {
      const img = new Image()
      img.className = 'reduced-still'
      img.alt = ''
      img.src = assets.worldVideo.still
      viewport.insertBefore(img, veil)
    }
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: true },
    })
    tl.set({}, {}, 1) // pin duration to 1 so positions read as scroll fractions
    tl.to(veil, { opacity: 0, duration: 0.18 }, 0)
      .fromTo(kicker, { opacity: 0 }, { opacity: 1, duration: 0.12 }, 0.05)
      .to(kicker, { opacity: 0, duration: 0.1 }, 0.3)
    captionEls.forEach((el, i) => {
      const at = 0.38 + i * 0.18
      tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.07 }, at)
        .to(el, { opacity: 0, duration: 0.06 }, at + 0.11)
    })
    return { wake, scrubber }
  }

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate (self) {
        scrubber?.setActive(self.progress > 0.02 && self.progress < 0.98)
      },
    },
  })

  tl.set({}, {}, 1) // pin duration to 1 so positions read as scroll fractions

  // darkness lifts as the traveller arrives
  tl.to(veil, { opacity: 0, duration: 0.07, ease: 'sine.out' }, 0)

  // a slow push-in settles the frame
  tl.fromTo(canvas, { scale: 1.07 }, { scale: 1, duration: 0.3, ease: 'sine.out' }, 0)

  // the chapter title greets the traveller, then yields to the film
  tl.fromTo(kicker,
    { opacity: 0, letterSpacing: '0.58em', filter: 'blur(8px)' },
    { opacity: 1, letterSpacing: '0.4em', filter: 'blur(0px)', duration: 0.05, ease: 'sine.out' }, 0.02)
  tl.to(kicker, { opacity: 0, filter: 'blur(6px)', duration: 0.045, ease: 'sine.in' }, 0.1)

  // the journey itself
  if (scrubber) tl.to(scrubber.state, { target: 1, duration: 0.86 }, 0.08)

  // whispered waypoints along the way
  captionEls.forEach((el, i) => {
    const at = 0.24 + i * 0.24
    tl.fromTo(el,
      { opacity: 0, letterSpacing: '0.52em', filter: 'blur(7px)' },
      { opacity: 1, letterSpacing: '0.4em', filter: 'blur(0px)', duration: 0.05, ease: 'sine.out' }, at)
    tl.to(el, { opacity: 0, filter: 'blur(6px)', duration: 0.045, ease: 'sine.in' }, at + 0.1)
  })

  // the air cools as the journey ends — the North is close
  const chill = section.querySelector('.world-chill')
  if (chill) tl.to(chill, { opacity: 0.92, duration: 0.08, ease: 'sine.in' }, 0.92)

  return { wake, scrubber }
}
