/**
 * Chapter: Jon Snow — The North.
 *
 * The visitor leaves the world map and the air turns to ice: blue light,
 * thickening fog, first snow. Then the film takes over — scroll-scrubbed
 * frame by frame — while story moments surface at the right beats. The
 * battle rages (storm, lightning, a breath of camera shake), the storm
 * stills for the dragon bond, everything falls to black… and out of the
 * silence rises the memorial: JON SNOW, his names, and the closing words.
 *
 * The timeline writes values only — to the `storm` state (rendered by the
 * snowfield), to CSS variables (rendered by composited light layers), and
 * to the scrubber target. Positions are chapter-scroll fractions.
 */
import { gsap, ScrollTrigger, createRangeGate } from '../core/scroll.js'
import { quality, reducedMotion } from '../core/quality.js'
import { assets } from '../core/assets.js'
import { site } from '../config/site.config.js'
import { chapterRunwayVh } from '../core/pacing.js'
import { createScrubber } from '../scrub/scrubber.js'
import { createSnowfield } from '../fx/snow.js'

export function buildJon ({ worldScrubber } = {}) {
  const section = document.getElementById('jon')
  const viewport = section.querySelector('.jon-viewport')
  const shakeWrap = section.querySelector('.jon-shake')
  const canvas = document.getElementById('jon-canvas')
  const snowCanvas = document.getElementById('jon-snow')
  const veil = section.querySelector('.jon-veil')
  const kicker = section.querySelector('.jon-kicker')
  const momentHost = section.querySelector('.jon-moments')
  const finaleHost = section.querySelector('.jon-finale')

  // ---- pacing & copy from config ------------------------------------------
  const cfg = site.jon
  // the scrub occupies 0.68 of this chapter — runway follows the film
  const fallbackVh = (quality.tier === 'mobile' || quality.tier === 'low')
    ? cfg.lengthVhMobile
    : cfg.lengthVh
  const lengthVh = reducedMotion
    ? cfg.lengthVhReduced
    : chapterRunwayVh(assets.jonVideo?.meta, 0.68, fallbackVh)
  section.style.height = `${lengthVh}vh`

  kicker.textContent = cfg.kicker

  const moments = cfg.moments.map(m => {
    const el = document.createElement('div')
    el.className = `jon-moment side-${m.side || 'center'}`
    el.setAttribute('aria-hidden', 'true')
    const rule = document.createElement('span')
    rule.className = 'jon-moment-rule'
    const title = document.createElement('h3')
    title.className = 'jon-moment-title'
    title.textContent = m.title
    const text = document.createElement('p')
    text.className = 'jon-moment-text'
    text.textContent = m.text
    el.append(rule, title, text)
    momentHost.appendChild(el)
    return { ...m, el, rule, title, text }
  })

  const finale = {
    name: document.createElement('h2'),
    subtitleSlot: document.createElement('p'),
    rule: document.createElement('span'),
    quote: document.createElement('p'),
  }
  finale.name.className = 'jon-finale-name'
  finale.name.textContent = cfg.finale.name
  finale.subtitleSlot.className = 'jon-finale-subtitle'
  finale.rule.className = 'jon-finale-rule'
  finale.quote.className = 'jon-finale-quote'
  finale.quote.textContent = cfg.finale.quote
  finaleHost.append(finale.name, finale.subtitleSlot, finale.rule, finale.quote)

  // subtitles swap through one slot beneath the name
  const subtitleEls = cfg.finale.subtitles.map(text => {
    const span = document.createElement('span')
    span.textContent = text
    finale.subtitleSlot.appendChild(span)
    return span
  })

  // ---- the film ------------------------------------------------------------
  let scrubber = null
  if (assets.jonVideo) {
    scrubber = createScrubber({
      canvas,
      source: assets.jonVideo,
      autostart: false,
      maxFrames: quality.longScrubFrames,
      fit: 'cover', // character chapters run true full-bleed on every device
    })
    // extraction begins once the world's film is fully captured (or was
    // never created) — the chain intro -> world -> jon keeps the media
    // pipeline single-file
    const readyToStart = () => !worldScrubber || worldScrubber.state.done
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
    console.info('[jon] no video in assets/jon/ yet — the chapter runs as cold atmosphere until one is dropped.')
  }

  // ---- reduced motion: stills, simple fades, full story preserved ---------
  if (reducedMotion) {
    if (assets.jonVideo?.still) {
      const img = new Image()
      img.className = 'reduced-still'
      img.alt = ''
      img.src = assets.jonVideo.still
      shakeWrap.insertBefore(img, veil)
    }
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: true },
    })
    tl.set({}, {}, 1)
    tl.to(veil, { opacity: 0.25, duration: 0.1 }, 0)
      .fromTo(kicker, { opacity: 0 }, { opacity: 1, duration: 0.06 }, 0.02)
      .to(kicker, { opacity: 0, duration: 0.05 }, 0.12)
    moments.forEach((m, i) => {
      const at = 0.18 + i * 0.11
      tl.fromTo(m.el, { opacity: 0 }, { opacity: 1, duration: 0.05 }, at)
        .to(m.el, { opacity: 0, duration: 0.04 }, at + 0.075)
    })
    tl.to(veil, { opacity: 1, duration: 0.06 }, 0.78)
    tl.fromTo(finale.name, { opacity: 0 }, { opacity: 1, duration: 0.05 }, 0.85)
    subtitleEls.forEach((el, i) => {
      const at = 0.87 + i * 0.035
      tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.02 }, at)
      if (i < subtitleEls.length - 1) tl.to(el, { opacity: 0, duration: 0.015 }, at + 0.025)
    })
    tl.fromTo(finale.rule, { opacity: 0 }, { opacity: 1, duration: 0.03 }, 0.965)
    tl.fromTo(finale.quote, { opacity: 0 }, { opacity: 1, duration: 0.03 }, 0.975)
    return { scrubber }
  }

  // ---- the storm -----------------------------------------------------------
  const storm = { snow: 0, wind: -0.25, gust: 0, fog: 0, ice: 0, shake: 0 }
  const snowfield = createSnowfield(snowCanvas, storm)

  // pause the snowfield entirely when the chapter is far away
  createRangeGate(
    { trigger: section, start: 'top 130%', end: 'bottom -30%' },
    near => snowfield.setVisible(near),
  )

  // camera shake — the environment trembles, the words never do
  let shakeSeed = 0
  gsap.ticker.add((_t, deltaMs) => {
    if (storm.shake < 0.004) {
      if (shakeSeed !== 0) { shakeWrap.style.transform = ''; shakeSeed = 0 }
      return
    }
    shakeSeed += deltaMs / 1000
    const s = storm.shake
    const x = (Math.sin(shakeSeed * 31.7) + Math.sin(shakeSeed * 19.3 + 2)) * 1.6 * s
    const y = (Math.sin(shakeSeed * 27.1 + 1) + Math.sin(shakeSeed * 41.9)) * 1.2 * s
    const r = Math.sin(shakeSeed * 13.7 + 3) * 0.12 * s
    shakeWrap.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${r.toFixed(3)}deg)`
  })

  // CSS light variables (cold light, lightning) — written only on change
  const vars = { cold: -1, flash: -1 }
  const lightState = { cold: 0, flash: 0 }
  gsap.ticker.add(() => {
    for (const key in lightState) {
      if (Math.abs(lightState[key] - vars[key]) > 0.002) {
        vars[key] = lightState[key]
        viewport.style.setProperty(`--jon-${key}`, lightState[key].toFixed(3))
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
  tl.set({}, {}, 1) // positions read as scroll fractions

  const at = (obj, varsIn, start, end, ease = 'sine.inOut') =>
    tl.to(obj, { ...varsIn, duration: Math.max(end - start, 0.001), ease }, start)

  // — arrival: the world turns to ice —
  at(lightState, { cold: 0.5 }, 0, 0.08)
  at(storm, { snow: 0.3, fog: 0.45, ice: 0.2 }, 0.01, 0.09)
  at(veil, { opacity: 0 }, 0.03, 0.11, 'sine.out')
  tl.fromTo(kicker,
    { opacity: 0, letterSpacing: '0.6em', filter: 'blur(9px)' },
    { opacity: 1, letterSpacing: '0.42em', filter: 'blur(0px)', duration: 0.045, ease: 'sine.out' }, 0.025)
  at(kicker, { opacity: 0, filter: 'blur(7px)' }, 0.085, 0.115, 'sine.in')

  // — the film wakes beneath the frost —
  tl.fromTo(canvas, { scale: 1.07 }, { scale: 1, duration: 0.22, ease: 'sine.out' }, 0.06)
  if (scrubber) at(scrubber.state, { target: 1 }, 0.1, 0.78, 'none')

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
    // slow drift while it holds — cinema, not signage
    tl.fromTo(m.el, { y: 8 }, { y: -8, duration: end - start, ease: 'none' }, start)
    at(m.el, { opacity: 0, filter: 'blur(5px)' }, end - 0.018, end, 'sine.in')
    tl.set(m.el, { opacity: 0 }, end + 0.001)
  }

  // — the battle: the storm takes the field —
  at(storm, { snow: 0.85, fog: 0.7, gust: 0.85, wind: -0.6, ice: 0.45, shake: 0.5 }, 0.17, 0.24)
  at(lightState, { cold: 0.66 }, 0.17, 0.24)

  const strike = (pos, power) => {
    at(lightState, { flash: power }, pos, pos + 0.005, 'power2.in')
    at(lightState, { flash: 0 }, pos + 0.005, pos + 0.026, 'power2.out')
    at(storm, { shake: 0.9 }, pos, pos + 0.006)
    at(storm, { shake: 0.5 }, pos + 0.006, pos + 0.03)
  }
  strike(0.215, 0.6)
  strike(0.29, 0.45)
  strike(0.365, 0.7)
  strike(0.375, 0.35) // echo
  strike(0.455, 0.55)

  // war at full pitch through Hardhome, then the field falls quiet
  at(storm, { snow: 1, gust: 1, wind: -0.85 }, 0.34, 0.42)
  at(storm, { snow: 0.5, gust: 0.4, wind: -0.35, fog: 0.5, shake: 0.15 }, 0.5, 0.58)

  // — the dragon bond: majesty, thin icy air —
  at(storm, { snow: 0.22, gust: 0.12, wind: -0.18, fog: 0.3, ice: 0.3, shake: 0 }, 0.6, 0.68)
  at(lightState, { cold: 0.38 }, 0.6, 0.68)

  // — everything falls to black —
  at(veil, { opacity: 1 }, 0.78, 0.845, 'sine.inOut')
  at(storm, { snow: 0.08, fog: 0.12, ice: 0.12, gust: 0 }, 0.78, 0.85)
  at(lightState, { cold: 0.12 }, 0.78, 0.85)
  // …silence [0.845 – 0.87]…

  // — the memorial —
  tl.fromTo(finale.name,
    { opacity: 0, scale: 0.94, letterSpacing: '0.34em', filter: 'blur(14px)' },
    { opacity: 1, scale: 1, letterSpacing: '0.12em', filter: 'blur(0px)', duration: 0.03, ease: 'sine.out' }, 0.87)

  const sub = (el, inStart, outStart) => {
    tl.fromTo(el, { opacity: 0, y: 14, filter: 'blur(6px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.018, ease: 'sine.out' }, inStart)
    if (outStart) at(el, { opacity: 0, filter: 'blur(5px)' }, outStart, outStart + 0.014, 'sine.in')
  }
  sub(subtitleEls[0], 0.905, 0.932)
  sub(subtitleEls[1], 0.936, 0.962)
  sub(subtitleEls[2], 0.966, null) // the last name he carries — it stays

  tl.fromTo(finale.rule, { scaleX: 0 }, { scaleX: 1, duration: 0.02, ease: 'power2.inOut' }, 0.978)
  tl.fromTo(finale.quote, { opacity: 0, y: 12 },
    { opacity: 1, y: 0, duration: 0.02, ease: 'sine.out' }, 0.984)

  // faint ice-dust keeps the memorial breathing
  at(storm, { ice: 0.24 }, 0.9, 1)

  return { scrubber }
}
