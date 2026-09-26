/**
 * The living atmosphere: ash motes, rising embers and drifting fog rendered
 * into one full-viewport canvas. Runs on the shared GSAP ticker, reads the
 * `atmo` state that the master timeline animates, and adapts its density to
 * the device tier.
 */
import { gsap } from '../core/scroll.js'
import { quality } from '../core/quality.js'
import { atmo } from './state.js'
import { emberSprite, ashSprite, fogCool, fogWarmSprite } from './sprites.js'

const TAU = Math.PI * 2
const rand = (a, b) => a + Math.random() * (b - a)

export function createAtmosphere (canvas) {
  const ctx = canvas.getContext('2d', { alpha: true })
  let w = 0
  let h = 0
  let dpr = quality.dpr

  // --- particle pools ------------------------------------------------------

  const ash = Array.from({ length: quality.ash }, () => ({
    x: Math.random(), y: Math.random(),
    size: rand(0.7, 2.1), speed: rand(0.012, 0.05),
    sway: rand(0.2, 1), phase: rand(0, TAU), alpha: rand(0.25, 0.8),
  }))

  const embers = Array.from({ length: quality.emberMax }, () => ({ alive: false }))
  let emberClock = 0

  const igniteEmber = (e) => {
    e.alive = true
    e.x = Math.random()
    e.y = 1.05 + Math.random() * 0.1
    e.vy = rand(0.05, 0.16)
    e.vx = rand(-0.01, 0.01)
    e.size = rand(1.0, 2.7)
    e.life = 0
    e.lifespan = rand(4, 9)
    e.phase = rand(0, TAU)
    e.flicker = rand(4, 9)
  }

  const fog = Array.from({ length: quality.fogSprites }, (_, i) => ({
    x: Math.random(), y: rand(0.15, 0.95),
    scale: rand(1.1, 2.4), speed: rand(0.008, 0.022) * (i % 2 ? 1 : -1),
    band: i % 2, // 0 = far, 1 = near
    phase: rand(0, TAU),
  }))

  // --- sizing --------------------------------------------------------------

  function resize () {
    dpr = quality.fxDpr
    w = canvas.clientWidth
    h = canvas.clientHeight
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  // --- render --------------------------------------------------------------

  let time = 0
  let awake = true

  function render (_t, deltaMs) {
    // the stage sleeps once the visitor is deep in the chapters — a hidden
    // full-screen canvas must cost nothing
    if (!awake) return
    const dt = Math.min(deltaMs / 1000, 0.05) // clamp spiral-of-death frames
    time += dt
    const calm = 1 - atmo.heroMode * 0.45 // hero ambience breathes slower
    const windPx = atmo.wind * w * 0.016

    ctx.clearRect(0, 0, w, h)

    // fog (far band under particles, near band over) --------------------
    const drawFogBand = (band) => {
      if (atmo.fogAlpha <= 0.003) return
      for (const f of fog) {
        if (f.band !== band) continue
        f.x += f.speed * dt * calm
        const breathe = 1 + Math.sin(time * 0.11 * calm + f.phase) * 0.06
        const size = Math.max(w, h) * f.scale * breathe
        const x = ((f.x % 1.6) + 1.6) % 1.6 * (w + size) - size * 0.8
        const y = f.y * h - size / 2
        const baseA = atmo.fogAlpha * (band ? 0.55 : 0.8)
        if (atmo.fogWarm < 0.999) {
          ctx.globalAlpha = baseA * (1 - atmo.fogWarm)
          ctx.drawImage(fogCool, x, y, size, size)
        }
        if (atmo.fogWarm > 0.001) {
          ctx.globalAlpha = baseA * atmo.fogWarm
          ctx.drawImage(fogWarmSprite, x, y, size, size)
        }
      }
      ctx.globalAlpha = 1
    }

    drawFogBand(0)

    // ash ---------------------------------------------------------------
    if (atmo.ash > 0.004) {
      for (const p of ash) {
        p.y += p.speed * dt * calm
        p.x += (Math.sin(time * 0.5 * calm + p.phase) * p.sway * 0.014 + windPx / w) * dt
        if (p.y > 1.05) { p.y = -0.05; p.x = Math.random() }
        if (p.x > 1.05) p.x -= 1.1
        if (p.x < -0.05) p.x += 1.1
        const tw = 0.75 + Math.sin(time * 1.3 + p.phase * 3) * 0.25
        ctx.globalAlpha = p.alpha * atmo.ash * tw
        const s = p.size * 6
        ctx.drawImage(ashSprite, p.x * w - s / 2, p.y * h - s / 2, s, s)
      }
      ctx.globalAlpha = 1
    }

    // embers (additive) -------------------------------------------------
    if (atmo.embers > 0.004) {
      emberClock += dt * atmo.embers * quality.emberMax * 0.55 * calm
      while (emberClock > 1) {
        emberClock -= 1
        const slot = embers.find(e => !e.alive)
        if (slot) igniteEmber(slot)
        else break
      }
    }
    ctx.globalCompositeOperation = 'lighter'
    for (const e of embers) {
      if (!e.alive) continue
      e.life += dt
      if (e.life > e.lifespan || e.y < -0.08) { e.alive = false; continue }
      e.vx += Math.sin(time * 1.7 + e.phase) * 0.004 * dt * 60
      e.vx *= 0.985
      e.y -= e.vy * dt * calm * (0.7 + 0.3 * Math.sin(time + e.phase))
      e.x += e.vx * dt * calm + (windPx / w) * dt * 2.4
      const lifeFade = Math.min(e.life * 2, 1) * (1 - Math.pow(e.life / e.lifespan, 2))
      const flicker = 0.72 + Math.sin(time * e.flicker + e.phase) * 0.28
      ctx.globalAlpha = lifeFade * flicker * Math.min(atmo.embers * 1.6 + 0.1, 1)
      const s = e.size * 8 * (1 + (1 - lifeFade) * 0.3)
      ctx.drawImage(emberSprite, e.x * w - s / 2, e.y * h - s / 2, s, s)
    }
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1

    drawFogBand(1)
  }

  resize()
  gsap.ticker.add(render)
  window.addEventListener('resize', resize)

  return {
    resize,
    /** Sleep/wake the whole system (the stage is hidden while asleep). */
    setAwake (value) { awake = value },
    destroy () {
      gsap.ticker.remove(render)
      window.removeEventListener('resize', resize)
    },
  }
}
