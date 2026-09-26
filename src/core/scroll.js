/**
 * Smooth scrolling foundation: Lenis drives window scroll with inertial
 * easing, GSAP's ticker is the single rAF heartbeat for the whole site, and
 * ScrollTrigger stays perfectly in sync.
 */
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { reducedMotion } from './quality.js'

gsap.registerPlugin(ScrollTrigger)

export { gsap, ScrollTrigger }

export let lenis = null

// One shared answer to "is the visitor scrolling right now?" — heavy
// background work (frame extraction) yields while this is true so the
// scroll thread always wins.
let lastScrollAt = 0
export const scrollBusy = () => performance.now() - lastScrollAt < 150

export function initScroll () {
  window.addEventListener('scroll', () => { lastScrollAt = performance.now() }, { passive: true })
  if (!reducedMotion) {
    lenis = new Lenis({
      autoRaf: false,
      duration: 1.15,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false, // native touch scrolling on mobile feels best
      touchMultiplier: 1.4,
    })
    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add(time => lenis.raf(time * 1000))
    gsap.ticker.lagSmoothing(0)
  }

  ScrollTrigger.config({ ignoreMobileResize: true })
}

/**
 * A range gate: reports whether the scroll position is inside a zone, both
 * on change and on refresh (so initial state is always correct). The whole
 * site uses this one mechanism to sleep everything the visitor can't see.
 */
export function createRangeGate (vars, apply) {
  // isActive can be undefined during a refresh pass — derive the in-range
  // state from progress so the gate always reports a real boolean
  const report = self => apply(self.isActive === true || (self.progress > 0 && self.progress < 1))
  return ScrollTrigger.create({
    ...vars,
    onToggle: report,
    onRefresh: report,
  })
}

/** Smoothly travel to a target (used by nav, CTA and the skip button). */
export function scrollTo (target, opts = {}) {
  if (lenis) {
    lenis.scrollTo(target, { duration: 2.2, easing: t => 1 - Math.pow(1 - t, 3), ...opts })
  } else {
    const el = typeof target === 'string' ? document.querySelector(target) : target
    if (typeof target === 'number') window.scrollTo({ top: target, behavior: reducedMotion ? 'auto' : 'smooth' })
    else el?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' })
  }
}
