/**
 * The firefield — the living heat of House Targaryen.
 *
 * One canvas carries rising embers, quick sparks, falling warm ash and
 * drifting golden smoke. Everything reads from a `blaze` state object the
 * chapter timeline writes as the visitor scrolls:
 *
 *   embers 0..1  rising fire motes
 *   sparks 0..1  fast hot streaks
 *   ash    0..1  slowly falling grey-gold flakes (the aftermath)
 *   smoke  0..1  golden smoke thickness
 *   heat   0..1  updraft strength / turbulence
 *   burst  0..1  momentary surges (spiked by the timeline at fire bursts)
 *
 * Same discipline as the snowfield: pre-baked sprites, one shared ticker,
 * pooled particles, density from the device tier.
 */
import { gsap } from '../core/scroll.js'
import { quality } from '../core/quality.js'
import { emberSprite, ashSprite, fogWarmSprite } from './sprites.js'

const TAU = Math.PI * 2
const rand = (a, b) => a + Math.random() * (b - a)

export function createFirefield (canvas, blaze) {
  const ctx = canvas.getContext('2d', { alpha: true })
  let w = 0
  let h = 0

  const EMBERS = Math.round(quality.emberMax * 1.2)
  const SPARKS = Math.round(quality.emberMax * 0.5)
  const ASH = Math.round(quality.ash * 1.4)

  const embers = Array.from({ length: EMBERS }, () => ({ alive: false }))
  let emberClock = 0
  const igniteEmber = (e) => {
    e.alive = true
    e.x = Math.random()
    e.y = 1.04 + Math.random() * 0.08
    e.vy = rand(0.05, 0.15)
    e.vx = rand(-0.012, 0.012)
    e.size = rand(1, 2.6)
    e.life = 0
    e.lifespan = rand(4, 9)
    e.phase = rand(0, TAU)
    e.flicker = rand(4, 9)
  }

  const sparks = Array.from({ length: SPARKS }, () => ({ alive: false }))
  let sparkClock = 0
  const igniteSpark = (s) => {
    s.alive = true
    s.x = Math.random()
    s.y = 1.02 + Math.random() * 0.06
    s.vy = rand(0.25, 0.55)
    s.vx = rand(-0.06, 0.06)
    s.life = 0
    s.lifespan = rand(0.8, 1.8)
    s.phase = rand(0, TAU)
  }

  const ash = Array.from({ length: ASH }, () => ({
    x: Math.random(), y: Math.random(),
    depth: rand(0.35, 1),
    speed: 0, size: 0, sway: rand(0.3, 1), phase: rand(0, TAU), alpha: rand(0.3, 0.8),
  }))
  for (const a of ash) { a.speed = 0.018 + a.depth * 0.05; a.size = 2.5 + a.depth * 5.5 }

  const smoke = Array.from({ length: Math.max(3, Math.round(quality.fogSprites * 0.6)) }, (_, i) => ({
    x: Math.random(), y: rand(0.2, 1),
    scale: rand(1.3, 2.6), speed: rand(0.01, 0.026) * (i % 2 ? 1 : -1),
    rise: rand(0.006, 0.016), phase: rand(0, TAU),
  }))

  function resize () {
    w = canvas.clientWidth
    h = canvas.clientHeight
    canvas.width = Math.round(w * quality.fxDpr)
    canvas.height = Math.round(h * quality.fxDpr)
    ctx.setTransform(quality.fxDpr, 0, 0, quality.fxDpr, 0, 0)
  }

  let time = 0
  let visible = true
  let cleared = false

  function render (_t, deltaMs) {
    if (!visible) return
    const dt = Math.min(deltaMs / 1000, 0.05)
    time += dt

    const anyLife = blaze.embers > 0.004 || blaze.ash > 0.004 || blaze.smoke > 0.004 || blaze.sparks > 0.004
    if (!anyLife) {
      if (!cleared) { ctx.clearRect(0, 0, w, h); cleared = true }
      return // dormant: no clears, no uploads, nothing
    }
    cleared = false
    ctx.clearRect(0, 0, w, h)

    const surge = 1 + blaze.burst * 2.2

    // golden smoke (behind particles)
    if (blaze.smoke > 0.004) {
      for (const f of smoke) {
        f.x += f.speed * dt * (1 + blaze.heat)
        f.y -= f.rise * dt * (0.4 + blaze.heat)
        if (f.y < -0.4) f.y = 1.2
        const size = Math.max(w, h) * f.scale
        const x = (((f.x % 1.7) + 1.7) % 1.7) * (w + size) - size * 0.85
        ctx.globalAlpha = blaze.smoke * 0.3
        ctx.drawImage(fogWarmSprite, x, f.y * h - size / 2, size, size)
      }
      ctx.globalAlpha = 1
    }

    // falling ash — the quiet after the fire
    if (blaze.ash > 0.004) {
      const lit = Math.ceil(ash.length * Math.min(blaze.ash * 1.15, 1))
      for (let i = 0; i < lit; i++) {
        const a = ash[i]
        a.y += a.speed * dt
        a.x += Math.sin(time * 0.5 + a.phase) * a.sway * 0.01 * dt
        if (a.y > 1.05) { a.y = -0.05; a.x = Math.random() }
        ctx.globalAlpha = a.alpha * Math.min(blaze.ash * 1.25, 1) * (0.4 + a.depth * 0.6)
        ctx.drawImage(ashSprite, a.x * w - a.size / 2, a.y * h - a.size / 2, a.size, a.size)
      }
      ctx.globalAlpha = 1
    }

    // embers + sparks (additive heat)
    ctx.globalCompositeOperation = 'lighter'

    if (blaze.embers > 0.004) {
      emberClock += dt * blaze.embers * EMBERS * 0.5 * surge
      while (emberClock > 1) {
        emberClock -= 1
        const slot = embers.find(e => !e.alive)
        if (slot) igniteEmber(slot)
        else break
      }
    }
    for (const e of embers) {
      if (!e.alive) continue
      e.life += dt
      if (e.life > e.lifespan || e.y < -0.08) { e.alive = false; continue }
      e.vx += Math.sin(time * 1.6 + e.phase) * 0.0045 * dt * 60 * (0.5 + blaze.heat)
      e.vx *= 0.985
      e.y -= e.vy * dt * (0.7 + blaze.heat * 0.7) * (0.7 + 0.3 * Math.sin(time + e.phase))
      e.x += e.vx * dt
      const lifeFade = Math.min(e.life * 2, 1) * (1 - Math.pow(e.life / e.lifespan, 2))
      const flicker = 0.72 + Math.sin(time * e.flicker + e.phase) * 0.28
      ctx.globalAlpha = lifeFade * flicker * Math.min(blaze.embers * 1.5 + 0.1, 1)
      const s = e.size * 8 * (1 + (1 - lifeFade) * 0.3)
      ctx.drawImage(emberSprite, e.x * w - s / 2, e.y * h - s / 2, s, s)
    }

    // sparks — short, fast, hot; they streak upward
    if (blaze.sparks > 0.004) {
      sparkClock += dt * blaze.sparks * SPARKS * 0.9 * surge
      while (sparkClock > 1) {
        sparkClock -= 1
        const slot = sparks.find(s => !s.alive)
        if (slot) igniteSpark(slot)
        else break
      }
    }
    for (const s of sparks) {
      if (!s.alive) continue
      s.life += dt
      if (s.life > s.lifespan || s.y < -0.06) { s.alive = false; continue }
      s.y -= s.vy * dt * (0.8 + blaze.heat * 0.6)
      s.x += s.vx * dt + Math.sin(time * 3 + s.phase) * 0.01 * dt
      const fade = 1 - s.life / s.lifespan
      ctx.globalAlpha = fade * Math.min(blaze.sparks * 1.4, 1)
      const streak = 1 + s.vy * 8
      ctx.drawImage(emberSprite, s.x * w - 2, s.y * h - 2 * streak, 4, 4 * streak)
    }

    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
  }

  resize()
  gsap.ticker.add(render)
  window.addEventListener('resize', resize)

  return {
    resize,
    /** Pause all work when the chapter is far off-screen. */
    setVisible (value) { visible = value },
    destroy () {
      gsap.ticker.remove(render)
      window.removeEventListener('resize', resize)
    },
  }
}
