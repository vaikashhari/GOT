/**
 * Chapter: Daenerys Targaryen — Fire and Blood.
 *
 * Out of Jon's black memorial, embers wake in the darkness and the air
 * warms into deep orange and gold. The film takes over — scroll-scrubbed,
 * true full-bleed — while gilded story moments surface at the right beats.
 * "Fire Will Answer": the blaze rises, a dragon shadow crosses, fire
 * bursts light the frame. Then the flames die, only embers remain, ash
 * falls through the silence… and the name is forged out of the heat —
 * glowing hot, cooling into gold. Queen of Ashes.
 */
import { gsap, ScrollTrigger, createRangeGate } from '../core/scroll.js'
import { quality, reducedMotion } from '../core/quality.js'
import { assets } from '../core/assets.js'
import { site } from '../config/site.config.js'
import { chapterRunwayVh } from '../core/pacing.js'
import { createScrubber } from '../scrub/scrubber.js'
import { createFirefield } from '../fx/fire.js'
import { createDragon } from '../fx/dragon.js'

export function buildDany ({ jonScrubber } = {}) {
  const section = document.getElementById('dany')
  const viewport = section.querySelector('.dany-viewport')
  const canvas = document.getElementById('dany-canvas')
  const fireCanvas = document.getElementById('dany-fire')
  const veil = section.querySelector('.dany-veil')
  const kicker = section.querySelector('.dany-kicker')
  const momentHost = section.querySelector('.dany-moments')
  const finaleHost = section.querySelector('.dany-finale')

  // ---- pacing & copy from config ------------------------------------------
  const cfg = site.dany
  // the scrub occupies 0.66 of this chapter — runway follows the film
  const fallbackVh = (quality.tier === 'mobile' || quality.tier === 'low')
    ? cfg.lengthVhMobile
    : cfg.lengthVh
  const lengthVh = reducedMotion
    ? cfg.lengthVhReduced
    : chapterRunwayVh(assets.danyVideo?.meta, 0.66, fallbackVh)
  section.style.height = `${lengthVh}vh`

  kicker.textContent = cfg.kicker

  const moments = cfg.moments.map(m => {
    const el = document.createElement('div')
    el.className = `dany-moment side-${m.side || 'center'}`
    el.setAttribute('aria-hidden', 'true')
    const rule = document.createElement('span')
    rule.className = 'dany-moment-rule'
    const title = document.createElement('h3')
    title.className = 'dany-moment-title'
    title.textContent = m.title
    const text = document.createElement('p')
    text.className = 'dany-moment-text'
    text.textContent = m.text
    el.append(rule, title, text)
    momentHost.appendChild(el)
    return { ...m, el, rule, title, text }
  })

  // finale: the name carries a "forge" twin that glows hot and cools away
  const finale = {
    nameWrap: document.createElement('div'),
    name: document.createElement('h2'),
    forge: document.createElement('span'),
    subtitle: document.createElement('p'),
    rule: document.createElement('span'),
    quote: document.createElement('p'),
  }
  finale.nameWrap.className = 'dany-finale-name-wrap'
  finale.name.className = 'dany-finale-name'
  finale.name.textContent = cfg.finale.name
  finale.forge.className = 'dany-finale-forge'
  finale.forge.setAttribute('aria-hidden', 'true')
  finale.forge.textContent = cfg.finale.name
  finale.nameWrap.append(finale.name, finale.forge)
  finale.subtitle.className = 'dany-finale-subtitle'
  finale.subtitle.textContent = cfg.finale.subtitle
  finale.rule.className = 'dany-finale-rule'
  finale.quote.className = 'dany-finale-quote'
  finale.quote.textContent = cfg.finale.quote
  finaleHost.append(finale.nameWrap, finale.subtitle, finale.rule, finale.quote)

  // ---- the film ------------------------------------------------------------
  let scrubber = null
  if (assets.danyVideo) {
    scrubber = createScrubber({
      canvas,
      source: assets.danyVideo,
      autostart: false,
      maxFrames: quality.longScrubFrames,
      fit: 'cover', // character chapters run true full-bleed on every device
    })
    const readyToStart = () => !jonScrubber || jonScrubber.state.done
    const poll = setInterval(() => {
      if (readyToStart()) { scrubber.start(); clearInterval(poll) }
    }, 900)
    ScrollTrigger.create({
      trigger: section,
      start: 'top 250%',
      once: true,
      onEnter: () => { scrubber.start(); clearInterval(poll) },
    })
    createRangeGate(
      { trigger: section, start: 'top 140%', end: 'bottom -40%' },
      near => scrubber.setNear(near),
    )
  } else if (import.meta.env.DEV) {
    console.info('[dany] no video in assets/dany/ yet — the chapter runs as fire atmosphere until one is dropped.')
  }

  // ---- reduced motion ------------------------------------------------------
  if (reducedMotion) {
    if (assets.danyVideo?.still) {
      const img = new Image()
      img.className = 'reduced-still'
      img.alt = ''
      img.src = assets.danyVideo.still
      viewport.insertBefore(img, veil)
    }
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: true },
    })
    tl.set({}, {}, 1)
    tl.to(veil, { opacity: 0.25, duration: 0.1 }, 0.02)
      .fromTo(kicker, { opacity: 0 }, { opacity: 1, duration: 0.06 }, 0.03)
      .to(kicker, { opacity: 0, duration: 0.05 }, 0.13)
    moments.forEach((m, i) => {
      const at = 0.2 + i * 0.13
      tl.fromTo(m.el, { opacity: 0 }, { opacity: 1, duration: 0.05 }, at)
        .to(m.el, { opacity: 0, duration: 0.04 }, at + 0.09)
    })
    tl.to(veil, { opacity: 1, duration: 0.06 }, 0.78)
    tl.fromTo(finale.nameWrap, { opacity: 0 }, { opacity: 1, duration: 0.05 }, 0.86)
    tl.fromTo(finale.subtitle, { opacity: 0 }, { opacity: 1, duration: 0.04 }, 0.92)
    tl.fromTo(finale.rule, { opacity: 0 }, { opacity: 1, duration: 0.03 }, 0.955)
    tl.fromTo(finale.quote, { opacity: 0 }, { opacity: 1, duration: 0.03 }, 0.965)
    gsap.set(finale.forge, { opacity: 0 })
    return { scrubber }
  }

  // ---- the blaze -----------------------------------------------------------
  const blaze = { embers: 0, sparks: 0, ash: 0, smoke: 0, heat: 0.3, burst: 0 }
  const firefield = createFirefield(fireCanvas, blaze)

  createRangeGate(
    { trigger: section, start: 'top 130%', end: 'bottom -30%' },
    near => firefield.setVisible(near),
  )

  const dragon = createDragon(viewport)
  dragon.classList.add('dany-dragon')

  // warm light + fire-burst flash, written as CSS variables on change only
  const vars = { warm: -1, burst: -1 }
  const lightState = { warm: 0, burst: 0 }
  gsap.ticker.add(() => {
    for (const key in lightState) {
      if (Math.abs(lightState[key] - vars[key]) > 0.002) {
        vars[key] = lightState[key]
        viewport.style.setProperty(`--dany-${key}`, lightState[key].toFixed(3))
      }
    }
  })

  // ---- choreography --------------------------------------------------------
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate (self) {
        scrubber?.setActive(self.progress > 0.04 && self.progress < 0.92)
      },
    },
  })
  tl.set({}, {}, 1)

  const at = (obj, varsIn, start, end, ease = 'sine.inOut') =>
    tl.to(obj, { ...varsIn, duration: Math.max(end - start, 0.001), ease }, start)

  // — out of Jon's darkness: embers wake, the air warms —
  at(blaze, { embers: 0.4, smoke: 0.3, sparks: 0.08 }, 0.01, 0.1)
  at(lightState, { warm: 0.5 }, 0.02, 0.11)
  tl.fromTo(kicker,
    { opacity: 0, letterSpacing: '0.6em', filter: 'blur(9px)' },
    { opacity: 1, letterSpacing: '0.42em', filter: 'blur(0px)', duration: 0.045, ease: 'sine.out' }, 0.03)
  at(kicker, { opacity: 0, filter: 'blur(7px)' }, 0.09, 0.12, 'sine.in')

  // — the film emerges beneath the heat —
  at(veil, { opacity: 0 }, 0.055, 0.125, 'sine.out')
  tl.fromTo(canvas, { scale: 1.07 }, { scale: 1, duration: 0.22, ease: 'sine.out' }, 0.06)
  if (scrubber) at(scrubber.state, { target: 1 }, 0.1, 0.76, 'none')

  // — story moments —
  const MOMENT_SPAN = 0.085
  for (const m of moments) {
    const start = m.at
    const end = m.at + MOMENT_SPAN
    tl.fromTo(m.rule, { scaleX: 0 }, { scaleX: 1, duration: 0.02, ease: 'power2.out' }, start)
    tl.fromTo(m.title,
      { opacity: 0, y: 26, filter: 'blur(8px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.028, ease: 'sine.out' }, start + 0.004)
    tl.fromTo(m.text,
      { opacity: 0, y: 18 },
      { opacity: 0.92, y: 0, duration: 0.026, ease: 'sine.out' }, start + 0.016)
    tl.fromTo(m.el, { y: 8 }, { y: -8, duration: end - start, ease: 'none' }, start)
    at(m.el, { opacity: 0, filter: 'blur(5px)' }, end - 0.018, end, 'sine.in')
    tl.set(m.el, { opacity: 0 }, end + 0.001)
  }

  // — Fire Will Answer: the blaze rises —
  at(blaze, { embers: 0.85, sparks: 0.45, smoke: 0.55, heat: 0.75 }, 0.56, 0.63)
  at(lightState, { warm: 0.85 }, 0.56, 0.63)

  // a dragon crosses the burning sky
  tl.fromTo(dragon,
    { xPercent: -160, x: 0, y: '14vh', rotation: 5, opacity: 0 },
    { xPercent: 40, x: '100vw', y: '30vh', rotation: -4, duration: 0.1, ease: 'none' }, 0.585)
  at(dragon, { opacity: 0.55 }, 0.585, 0.605, 'sine.out')
  at(dragon, { opacity: 0 }, 0.655, 0.685, 'sine.in')

  // fire bursts — surges of heat and light, scroll-tied
  const burst = (pos, power) => {
    at(lightState, { burst: power }, pos, pos + 0.006, 'power2.in')
    at(lightState, { burst: 0 }, pos + 0.006, pos + 0.03, 'power2.out')
    at(blaze, { burst: 1 }, pos, pos + 0.008)
    at(blaze, { burst: 0 }, pos + 0.008, pos + 0.04)
  }
  burst(0.6, 0.55)
  burst(0.655, 0.4)
  burst(0.7, 0.65)
  burst(0.71, 0.3) // echo

  // war of fire at full pitch
  at(blaze, { embers: 1, sparks: 0.7, smoke: 0.7, heat: 1 }, 0.66, 0.72)

  // — the flames die: only embers remain —
  at(veil, { opacity: 1 }, 0.75, 0.81, 'sine.inOut')
  at(blaze, { embers: 0.28, sparks: 0, smoke: 0.18, heat: 0.35 }, 0.75, 0.82)
  at(lightState, { warm: 0.16 }, 0.75, 0.82)

  // — ash becomes the world —
  at(blaze, { ash: 0.75, embers: 0.1, smoke: 0.06 }, 0.83, 0.885)
  at(lightState, { warm: 0.08 }, 0.83, 0.885)
  // …silence [0.885 – 0.9]…

  // — the name, forged from the heat, cooling into gold —
  tl.fromTo(finale.nameWrap,
    { opacity: 0, scale: 0.95, filter: 'blur(12px)' },
    { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.028, ease: 'sine.out' }, 0.9)
  tl.fromTo(finale.forge, { opacity: 1 }, { opacity: 0, duration: 0.045, ease: 'sine.inOut' }, 0.915)

  tl.fromTo(finale.subtitle,
    { opacity: 0, y: 14, filter: 'blur(6px)' },
    { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.02, ease: 'sine.out' }, 0.938)
  tl.fromTo(finale.rule, { scaleX: 0 }, { scaleX: 1, duration: 0.018, ease: 'power2.inOut' }, 0.955)
  tl.fromTo(finale.quote, { opacity: 0, y: 12 },
    { opacity: 1, y: 0, duration: 0.018, ease: 'sine.out' }, 0.968)

  // ash keeps drifting through the memorial
  at(blaze, { ash: 0.55 }, 0.9, 1)

  return { scrubber }
}
