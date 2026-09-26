/**
 * The master choreography. One scrubbed ScrollTrigger timeline maps the
 * prologue scroll (0-1) onto the five scenes:
 *
 *   darkness -> suspense (fog, thunder) -> fire & shadow (embers, dragon)
 *   -> title reveal (scrubbed video) -> hand-off into the hero.
 *
 * The timeline only writes values — to the shared `atmo` state, to CSS
 * custom properties on the stage, and to the scrubber's target. Rendering
 * happens elsewhere. Scroll up and the entire world rewinds with you.
 */
import { gsap, ScrollTrigger } from '../core/scroll.js'
import { atmo } from '../fx/state.js'
import { site } from '../config/site.config.js'

export function createMasterTimeline ({ stage, scrubLayer, scrubber, dragon, captions }) {
  const s = site.scenes

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '#prologue',
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate (self) {
        const p = self.progress
        scrubber?.setActive(p > 0.34 && p < 0.96)
        document.body.classList.toggle('in-hero', p > 0.965)
      },
    },
  })

  const at = (obj, vars, start, end, ease = 'sine.inOut') =>
    tl.to(obj, { ...vars, duration: Math.max(end - start, 0.001), ease }, start)

  // ---- Scene 1 -> 2 · darkness comes alive --------------------------------
  at(atmo, { coldLight: 0.2, ash: 0.5, fogAlpha: 0.3, wind: -0.3 }, s.suspense.start, s.suspense.end)
  at(atmo, { vignette: 0.55 }, s.suspense.start, s.suspense.end)

  // distant thunder — a double strike and a later echo, tied to scroll so
  // they reverse faithfully
  const strike = (pos, power) => {
    at(atmo, { flash: power }, pos, pos + 0.006, 'power2.in')
    at(atmo, { flash: 0 }, pos + 0.006, pos + 0.03, 'power2.out')
  }
  strike(0.185, 0.5)
  strike(0.205, 0.28)
  strike(0.275, 0.38)

  // whispered captions
  const caption = (el, inStart, inEnd, outStart, outEnd) => {
    if (!el) return
    tl.fromTo(el, { opacity: 0, letterSpacing: '0.6em', filter: 'blur(7px)' },
      { opacity: 1, letterSpacing: '0.42em', filter: 'blur(0px)', duration: inEnd - inStart, ease: 'sine.out' }, inStart)
    at(el, { opacity: 0, filter: 'blur(6px)' }, outStart, outEnd, 'sine.in')
  }
  caption(captions[0], 0.055, 0.1, 0.14, 0.18)
  caption(captions[1], 0.205, 0.245, 0.275, 0.315)

  // ---- Scene 3 · fire & shadow -------------------------------------------
  at(atmo, { embers: 0.22 }, 0.24, s.fire.start)
  at(atmo, {
    fireLight: 0.6, fogWarm: 0.75, fogAlpha: 0.26,
    embers: 0.75, ash: 0.22, coldLight: 0.1, vignette: 0.45, wind: -0.12,
  }, s.fire.start, s.fire.end)

  if (dragon) {
    tl.fromTo(dragon,
      { xPercent: -160, x: 0, y: '32vh', rotation: -6, opacity: 0 },
      { xPercent: 40, x: '100vw', y: '12vh', rotation: 4, duration: 0.115, ease: 'none' }, 0.335)
    at(dragon, { opacity: 0.5 }, 0.335, 0.36, 'sine.out')
    at(dragon, { opacity: 0 }, 0.42, 0.45, 'sine.in')
  }

  // ---- Scene 4 · the title reveal ----------------------------------------
  // The video opens on blazing gold, so firelight blooms to meet it and the
  // canvas fades in through that warmth — no cut, no black flash.
  at(atmo, { glow: 0.5, fireLight: 0.85 }, 0.42, 0.5)
  tl.fromTo(scrubLayer, { opacity: 0, scale: 1.06 },
    { opacity: 1, scale: 1.02, duration: 0.06, ease: 'sine.in' }, s.reveal.start)
  tl.to(scrubLayer, { scale: 1, duration: 0.37, ease: 'none' }, 0.5)

  // settle the ambience so the film carries the frame
  at(atmo, {
    glow: 0.15, fireLight: 0.35, fogAlpha: 0.15, ash: 0.1, embers: 0.42, vignette: 0.5,
  }, 0.52, 0.66)

  // the scrub itself — first 70% of the film, then a dwell that gives the
  // title and its fade-out generous scroll room
  at(scrubber.state, { target: 0.7 }, 0.5, 0.76, 'none')
  at(scrubber.state, { target: 1 }, 0.76, s.reveal.end, 'none')

  // a golden bloom as the title lands
  at(atmo, { glow: 0.32, embers: 0.55 }, 0.72, 0.8)
  at(atmo, { glow: 0 }, 0.82, 0.9)

  // ---- Scene 5 · hand-off into the hero ----------------------------------
  // The film fades itself to black; the world cools and calms around it and
  // the hero rises out of the same darkness.
  at(atmo, {
    fireLight: 0.12, coldLight: 0.15, embers: 0.34, ash: 0.3,
    fogAlpha: 0.2, fogWarm: 0.35, vignette: 0.62, wind: -0.08,
  }, s.handoff.start, 1)
  at(atmo, { heroMode: 1 }, 0.92, 1)
  at(scrubLayer, { opacity: 0 }, 0.94, 1, 'sine.in')

  // ---- CSS light-layer sync ----------------------------------------------
  const vars = { fire: -1, cold: -1, flash: -1, glow: -1, vig: -1 }
  const sync = () => {
    const map = {
      fire: atmo.fireLight, cold: atmo.coldLight,
      flash: atmo.flash, glow: atmo.glow, vig: atmo.vignette,
    }
    for (const key in map) {
      if (Math.abs(map[key] - vars[key]) > 0.002) {
        vars[key] = map[key]
        stage.style.setProperty(`--${key}`, map[key].toFixed(3))
      }
    }
  }
  gsap.ticker.add(sync)

  return tl
}

/**
 * Calm alternative for prefers-reduced-motion: no scrub, no particles —
 * the title still (last frame of the film) simply fades through as you
 * scroll a much shorter prologue.
 */
export function createReducedTimeline ({ stage, scrubLayer, still }) {
  stage.style.setProperty('--vig', '0.6')
  stage.style.setProperty('--cold', '0.12')

  if (still) {
    const img = new Image()
    img.className = 'reduced-still'
    img.alt = ''
    img.src = still
    scrubLayer.appendChild(img)
  }

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '#prologue', start: 'top top', end: 'bottom bottom', scrub: true },
  })
  tl.fromTo(scrubLayer, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.08)
    .to(scrubLayer, { opacity: 0, duration: 0.2 }, 0.8)
  ScrollTrigger.create({
    trigger: '#hero',
    start: 'top 70%',
    onEnter: () => document.body.classList.add('in-hero'),
    onLeaveBack: () => document.body.classList.remove('in-hero'),
  })
}
