/**
 * The hero: fixed navigation, headline, CTA and a living, mouse-responsive
 * environment. Content comes from site.config.js; the logo comes from
 * assets/logo/ (with an elegant wordmark fallback); background layers come
 * from assets/hero/ and become parallax planes automatically.
 */
import { gsap, ScrollTrigger, scrollTo, createRangeGate } from '../core/scroll.js'
import { quality, reducedMotion } from '../core/quality.js'
import { assets } from '../core/assets.js'
import { site } from '../config/site.config.js'

export function buildHero ({ onCta } = {}) {
  // ---- navigation ---------------------------------------------------------
  const nav = document.getElementById('site-nav')
  const logoSlot = nav.querySelector('.nav-logo')
  if (assets.logo) {
    const img = document.createElement('img')
    img.src = assets.logo.src
    img.alt = site.brand.wordmark
    img.className = 'nav-logo-img'
    logoSlot.appendChild(img)
  } else {
    logoSlot.innerHTML = `<span class="nav-wordmark">${site.brand.wordmark}</span>`
  }

  const list = nav.querySelector('.nav-links')
  for (const item of site.nav) {
    const li = document.createElement('li')
    const a = document.createElement('a')
    a.href = item.target
    a.textContent = item.label
    a.addEventListener('click', (e) => {
      e.preventDefault()
      scrollTo(item.target === '#top' ? 0 : item.target)
    })
    li.appendChild(a)
    list.appendChild(li)
  }

  // ---- hero content -------------------------------------------------------
  const hero = document.getElementById('hero')
  const kicker = hero.querySelector('.hero-kicker')
  const heading = hero.querySelector('.hero-heading')
  const subtitle = hero.querySelector('.hero-subtitle')
  const cta = hero.querySelector('.hero-cta')

  kicker.textContent = site.hero.kicker
  heading.textContent = site.hero.heading
  subtitle.textContent = site.hero.subtitle
  cta.textContent = site.hero.cta.label
  cta.addEventListener('click', (e) => {
    e.preventDefault()
    // the CTA can open a chapter (portal) rather than merely scroll
    if (onCta) onCta(site.hero.cta)
    else scrollTo(site.hero.cta.target)
  })

  // optional background layers from assets/hero/ — first file is deepest
  const layerHost = hero.querySelector('.hero-layers')
  const layers = assets.heroLayers.map((asset, i) => {
    const depth = (i + 1) / assets.heroLayers.length // 0..1, deeper = slower
    const div = document.createElement('div')
    div.className = 'hero-layer'
    div.style.zIndex = String(i)
    const img = document.createElement('img')
    img.src = asset.src
    img.alt = ''
    img.loading = 'lazy'
    img.draggable = false
    div.appendChild(img)
    layerHost.appendChild(div)
    return { el: div, depth }
  })

  // ---- reveal choreography ------------------------------------------------
  const lines = [kicker, heading, subtitle, cta]
  if (reducedMotion) {
    gsap.set(lines, { opacity: 1 })
    gsap.set(nav, { opacity: 1 })
    gsap.set(hero.querySelector('.hero-rule'), { scaleX: 1 })
  } else {
    gsap.set(nav, { yPercent: -110, opacity: 0 })
    const reveal = gsap.timeline({
      paused: true,
      defaults: { ease: 'power3.out' },
    })
    reveal
      .to(nav, { yPercent: 0, opacity: 1, duration: 1.1, ease: 'power2.out' }, 0.15)
      .fromTo(kicker, { opacity: 0, y: 26, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.0 }, 0.1)
      .fromTo(heading, { opacity: 0, y: 42, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.35 }, 0.28)
      .fromTo(subtitle, { opacity: 0, y: 30, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1 }, 0.52)
      .fromTo(cta, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.9 }, 0.74)
      .fromTo(hero.querySelector('.hero-rule'), { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: 'power2.inOut' }, 0.5)

    ScrollTrigger.create({
      trigger: hero,
      start: 'top 62%',
      onEnter: () => reveal.play(),
      onLeaveBack: () => reveal.reverse(),
    })

    // gentle scroll parallax on the content as the hero settles into place
    gsap.fromTo(hero.querySelector('.hero-content'),
      { y: '9vh' },
      {
        y: '0vh',
        ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top bottom', end: 'top top', scrub: true },
      })
  }

  // ---- mouse-responsive environment --------------------------------------
  if (!reducedMotion && !quality.coarse) {
    const glowEl = hero.querySelector('.hero-cursor-glow')
    const content = hero.querySelector('.hero-content')
    const pointer = { x: 0, y: 0 } // normalized -0.5 .. 0.5
    const eased = { x: 0, y: 0 }
    const glow = { x: 0.5, y: 0.62 }

    // the parallax only works while the hero itself is anywhere near
    let heroNear = false
    createRangeGate(
      { trigger: hero, start: 'top 130%', end: 'bottom -30%' },
      near => { heroNear = near },
    )

    window.addEventListener('pointermove', (e) => {
      pointer.x = e.clientX / innerWidth - 0.5
      pointer.y = e.clientY / innerHeight - 0.5
    }, { passive: true })

    const setContent = gsap.quickSetter(content, 'css')
    const setGlow = gsap.quickSetter(glowEl, 'css')
    const layerSetters = layers.map(l => gsap.quickSetter(l.el, 'css'))

    gsap.ticker.add((_t, deltaMs) => {
      if (!heroNear || !document.body.classList.contains('in-hero')) return
      const k = 1 - Math.pow(1 - 0.08, deltaMs / 16.7)
      eased.x += (pointer.x - eased.x) * k
      eased.y += (pointer.y - eased.y) * k
      glow.x += (pointer.x + 0.5 - glow.x) * k * 0.7
      glow.y += (pointer.y + 0.5 - glow.y) * k * 0.7

      setContent({ x: eased.x * -18, y: eased.y * -10 })
      setGlow({ x: (glow.x - 0.5) * innerWidth * 0.7, y: (glow.y - 0.5) * innerHeight * 0.7 })
      layers.forEach((l, i) => {
        layerSetters[i]({ x: eased.x * -34 * (1 - l.depth * 0.7), y: eased.y * -18 * (1 - l.depth * 0.7) })
      })
    })

    // magnetic CTA — a few pixels of attraction, nothing showy
    cta.addEventListener('pointermove', (e) => {
      const r = cta.getBoundingClientRect()
      gsap.to(cta, {
        x: (e.clientX - r.left - r.width / 2) * 0.18,
        y: (e.clientY - r.top - r.height / 2) * 0.3,
        duration: 0.5,
        ease: 'power2.out',
      })
    })
    cta.addEventListener('pointerleave', () => {
      gsap.to(cta, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.45)' })
    })
  }
}
