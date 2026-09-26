/**
 * Boot. Order matters: styles/fonts, scroll foundation, canvas systems,
 * choreography, hero — then lift the veil.
 */
import '@fontsource/cinzel/400.css'
import '@fontsource/cinzel/600.css'
import '@fontsource/cormorant-garamond/300.css'
import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/cormorant-garamond/400-italic.css'
import '@fontsource/cormorant-garamond/500.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/stage.css'
import './styles/nav.css'
import './styles/hero.css'
import './styles/world.css'
import './styles/portal.css'
import './styles/jon.css'
import './styles/dany.css'
import './styles/ending.css'
import './styles/epilogue.css'

import { site } from './config/site.config.js'
import { assets } from './core/assets.js'
import { quality, reducedMotion } from './core/quality.js'
import { initScroll, scrollTo, gsap, ScrollTrigger, createRangeGate } from './core/scroll.js'
import { createAtmosphere } from './fx/atmosphere.js'
import { createDragon } from './fx/dragon.js'
import { createScrubber } from './scrub/scrubber.js'
import { createMasterTimeline, createReducedTimeline } from './cinematic/timeline.js'
import { buildHero } from './hero/hero.js'
import { buildWorld } from './world/world.js'
import { buildJon } from './jon/jon.js'
import { buildDany } from './dany/dany.js'
import { buildEnding } from './ending/ending.js'
import { buildEpilogue } from './epilogue/epilogue.js'
import { initPortal } from './portal/portal.js'
import { lenis } from './core/scroll.js'

// A cinematic prologue starts from the top on every visit.
history.scrollRestoration = 'manual'
window.scrollTo(0, 0)

document.title = site.title

// ---- prologue length (config-driven pacing) --------------------------------
const prologue = document.getElementById('prologue')
const lengthVh = reducedMotion
  ? site.prologue.lengthVhReduced
  : (quality.tier === 'mobile' || quality.tier === 'low')
      ? site.prologue.lengthVhMobile
      : site.prologue.lengthVh
prologue.style.height = `${lengthVh}vh`

// ---- static copy -----------------------------------------------------------
const captionEls = [...document.querySelectorAll('.prologue-caption')]
site.prologue.captions.forEach((text, i) => { if (captionEls[i]) captionEls[i].textContent = text })
document.querySelector('.scroll-cue-label').textContent = site.prologue.scrollCue
const skipBtn = document.getElementById('skip-intro')
skipBtn.querySelector('span').textContent = site.prologue.skipLabel

// ---- foundation ------------------------------------------------------------
initScroll()

const stage = document.getElementById('stage')
const scrubLayer = document.getElementById('scrub-layer')

let scrubber = null

if (reducedMotion) {
  createReducedTimeline({ stage, scrubLayer, still: assets.introVideo?.still })
} else {
  const atmosphere = createAtmosphere(document.getElementById('atmo-canvas'))

  if (assets.introVideo) {
    scrubber = createScrubber({
      canvas: document.getElementById('scrub-canvas'),
      source: assets.introVideo,
    })
  } else {
    console.warn('[got] no video found in assets/intro/ — the title reveal is dark until one is added.')
    scrubber = { state: { target: 0 }, setActive () {}, setNear () {}, start () {}, resize () {} }
  }

  const dragon = createDragon(stage)
  createMasterTimeline({ stage, scrubLayer, scrubber, dragon, captions: captionEls })

  // the intro film only works while the prologue is anywhere near
  createRangeGate(
    { trigger: '#prologue', start: 'top bottom', end: 'bottom -80%' },
    near => scrubber.setNear(near),
  )

  // once the chapters cover the stage, the whole theatre sleeps — no
  // particle rendering, no compositing, nothing
  createRangeGate(
    { trigger: '#world', start: 'top 120%', end: '+=999999' },
    covered => {
      atmosphere.setAwake(!covered)
      document.body.classList.toggle('stage-asleep', covered)
    },
  )
}

// ---- the world beyond the portal -------------------------------------------
const world = buildWorld({ introScrubber: scrubber })

// ---- chapter: Jon Snow — The North -----------------------------------------
const jon = buildJon({ worldScrubber: world.scrubber })

// ---- chapter: Daenerys Targaryen — Fire and Blood --------------------------
const dany = buildDany({ jonScrubber: jon.scrubber })

// ---- the final ending sequence ---------------------------------------------
buildEnding()

// ---- the cinematic epilogue (the footer that is a scene) --------------------
buildEpilogue()

/** Land inside the world section at a given progress, instantly. */
const jumpIntoWorld = () => {
  const section = document.getElementById('world')
  const arrive = site.portal.arrivalProgress
  const y = section.offsetTop + (section.offsetHeight - innerHeight) * arrive
  if (lenis) lenis.scrollTo(y, { immediate: true, force: true })
  else window.scrollTo(0, y)
  ScrollTrigger.update()
}

const portal = initPortal({
  button: document.querySelector('.hero-cta'),
  coverDuration: site.portal.coverDuration,
  revealDuration: site.portal.revealDuration,
  onCovered: () => {
    world.wake() // begin world frame extraction behind the darkness
    jumpIntoWorld()
  },
  onDone: () => lenis?.start(),
})

buildHero({
  onCta: (cta) => {
    if (cta.action === 'portal') {
      lenis?.stop() // the world holds still during the crossing
      portal.enter()
    } else {
      scrollTo(cta.target)
    }
  },
})

// ---- scroll cue: fades away the moment the journey begins ------------------
const cue = document.querySelector('.scroll-cue')
let cueDismissed = false
const dismissCue = () => {
  if (cueDismissed || window.scrollY < 24) return
  cueDismissed = true
  gsap.to(cue, { opacity: 0, y: 12, duration: 0.8, ease: 'sine.in' })
}
window.addEventListener('scroll', dismissCue, { passive: true })

// ---- skip button -----------------------------------------------------------
skipBtn.addEventListener('click', () => scrollTo('#hero', { duration: 2.6 }))
gsap.to(skipBtn, { opacity: 1, duration: 1.2, delay: 1.6, ease: 'sine.out' })

// ---- ambience (only if an audio asset exists) ------------------------------
if (assets.ambience && !reducedMotion) {
  const btn = document.querySelector('.nav-audio')
  btn.hidden = false
  const audio = new Audio(assets.ambience.src)
  audio.loop = true
  audio.volume = 0
  let on = false
  btn.addEventListener('click', () => {
    on = !on
    btn.setAttribute('aria-pressed', String(on))
    btn.classList.toggle('is-on', on)
    if (on) { audio.play().catch(() => {}); gsap.to(audio, { volume: 0.4, duration: 1.5 }) } else {
      gsap.to(audio, { volume: 0, duration: 0.8, onComplete: () => audio.pause() })
    }
  })
}

// ---- lift the veil ---------------------------------------------------------
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    document.body.classList.add('is-ready')
    ScrollTrigger.refresh()
  })
})

if (import.meta.env.DEV) {
  const { atmo } = await import('./fx/state.js')
  const { lenis } = await import('./core/scroll.js')
  window.__got = { atmo, lenis, ScrollTrigger, gsap, scrubber, world, jon, dany }
}
