/**
 * The Cinematic Epilogue — technically the footer, spiritually the last
 * scene. The final film breathes full-width beneath the title and a single
 * farewell line; the practical footer details rest at the very bottom,
 * small and half-transparent, so the visitor knows the site has ended
 * without ever being handed a "footer".
 */
import { gsap, ScrollTrigger } from '../core/scroll.js'
import { reducedMotion } from '../core/quality.js'
import { assets } from '../core/assets.js'
import { site } from '../config/site.config.js'

const ICONS = {
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 4l16 16M20 4L4 20"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12.5" rx="3.5"/><path d="M10.2 9.6v5.3l4.8-2.65z" fill="currentColor" stroke="none"/></svg>',
}

export function buildEpilogue () {
  const section = document.getElementById('epilogue')
  const video = section.querySelector('.epilogue-video')
  const heading = section.querySelector('.epilogue-heading')
  const line = section.querySelector('.epilogue-line')
  const bar = section.querySelector('.epilogue-bar')

  const cfg = site.epilogue
  section.style.height = `${cfg.heightVh}vh`
  heading.textContent = cfg.heading
  line.textContent = cfg.line

  // ---- the footer facts, quiet and small ----------------------------------
  const copyright = document.createElement('p')
  copyright.className = 'epilogue-copyright'
  copyright.textContent = cfg.copyright
  bar.appendChild(copyright)

  const right = document.createElement('div')
  right.className = 'epilogue-links'
  for (const s of cfg.social || []) {
    if (!ICONS[s.name]) continue
    const a = document.createElement('a')
    a.className = 'epilogue-social'
    a.href = s.href || '#'
    a.setAttribute('aria-label', s.name)
    if (s.href && s.href !== '#') { a.target = '_blank'; a.rel = 'noreferrer noopener' }
    a.innerHTML = ICONS[s.name]
    right.appendChild(a)
  }
  if (cfg.contact) {
    const mail = document.createElement('a')
    mail.className = 'epilogue-contact'
    mail.href = `mailto:${cfg.contact}`
    mail.textContent = 'Contact'
    right.appendChild(mail)
  }
  bar.appendChild(right)

  // ---- the film ------------------------------------------------------------
  if (assets.epilogueVideo) {
    video.src = assets.epilogueVideo.src
    if (assets.epilogueVideo.poster) video.poster = assets.epilogueVideo.poster
    if (!reducedMotion) {
      // play only while on screen — the epilogue never burns idle power
      ScrollTrigger.create({
        trigger: section,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: self => {
          if (self.isActive) video.play().catch(() => {})
          else video.pause()
        },
      })
    } else {
      video.removeAttribute('autoplay')
    }
  } else {
    video.remove()
    if (import.meta.env.DEV) console.info('[epilogue] no video in assets/epilogue/ yet — the scene rests on darkness until one is dropped.')
  }

  // ---- the reveal ----------------------------------------------------------
  if (reducedMotion) {
    gsap.set([heading, line, bar], { opacity: 1 })
    return
  }

  const reveal = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } })
  reveal
    .fromTo(heading, { opacity: 0, y: 30, filter: 'blur(10px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.5 }, 0.2)
    .fromTo(line, { opacity: 0, y: 20, filter: 'blur(6px)' },
      { opacity: 0.85, y: 0, filter: 'blur(0px)', duration: 1.2 }, 0.55)
    .fromTo(section.querySelector('.epilogue-rule'), { scaleX: 0 },
      { scaleX: 1, duration: 1.5, ease: 'power2.inOut' }, 0.5)
    .fromTo(bar, { opacity: 0 }, { opacity: 1, duration: 1.2, ease: 'sine.out' }, 1.0)

  ScrollTrigger.create({
    trigger: section,
    start: 'top 68%',
    onEnter: () => reveal.play(),
    onLeaveBack: () => reveal.reverse(),
  })
}
