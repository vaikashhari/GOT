/**
 * The snowfield — the living cold of the North.
 *
 * One canvas carries falling snow, glinting ice motes and drifting storm
 * fog. Everything reads from a `storm` state object that the chapter
 * timeline writes as the visitor scrolls:
 *
 *   snow  0..1  flake density
 *   wind  -1..1 horizontal push (sign = direction)
 *   gust  0..1  turbulence / streaking of the wind
 *   fog   0..1  storm fog thickness
 *   ice   0..1  glinting ice-dust density
 *
 * Same performance discipline as the main atmosphere: pre-baked sprites,
 * one shared ticker, pooled particles, density from the device tier.
 */
import { gsap } from '../core/scroll.js'
import { quality } from '../core/quality.js'
import { ashSprite, fogCool } from './sprites.js'

const TAU = Math.PI * 2
const rand = (a, b) => a + Math.random() * (b - a)

export function createSnowfield (canvas, storm) {
  const ctx = canvas.getContext('2d', { alpha: true })
  let w = 0
  let h = 0

  const FLAKES = Math.round(quality.ash * 1.6)
  const ICE = Math.round(quality.ash * 0.5)

  const flakes = Array.from({ length: FLAKES }, () => ({
    x: Math.random(), y: Math.random(),
    depth: rand(0.35, 1), // far flakes: small, slow, dim
    size: 0, speed: 0, phase: rand(0, TAU), alpha: rand(0.35, 0.9),
  }))
  for (const f of flakes) {
    f.size = 2.5 + f.depth * 7
    f.speed = 0.03 + f.depth * 0.09
  }

  const ice = Array.from({ length: ICE }, () => ({
    x: Math.random(), y: Math.random(),
    drift: rand(-0.008, 0.008), rise: rand(-0.012, 0.006),
    phase: rand(0, TAU), twinkle: rand(2.5, 6),
  }))

  const fog = Array.from({ length: Math.max(3, Math.round(quality.fogSprites * 0.6)) }, (_, i) => ({
    x: Math.random(), y: rand(0.1, 0.9),
    scale: rand(1.3, 2.6), speed: rand(0.012, 0.03) * (i % 2 ? 1 : -1),
    phase: rand(0, TAU),
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

    const anyLife = storm.snow > 0.004 || storm.fog > 0.004 || storm.ice > 0.004
    if (!anyLife) {
      if (!cleared) { ctx.clearRect(0, 0, w, h); cleared = true }
      return // dormant: no clears, no uploads, nothing
    }
    cleared = false
    ctx.clearRect(0, 0, w, h)

    // gusting wind: the base push plus turbulent surges when gust is high
    const surge = Math.sin(time * 0.9) * 0.5 + Math.sin(time * 2.3 + 1.7) * 0.35
    const windNow = storm.wind * (1 + storm.gust * Math.max(surge, 0) * 1.6)

    // storm fog (behind the snow)
    if (storm.fog > 0.004) {
      for (const f of fog) {
        f.x += f.speed * dt * (1 + storm.gust)
        const size = Math.max(w, h) * f.scale
        const x = (((f.x % 1.7) + 1.7) % 1.7) * (w + size) - size * 0.85
        const y = f.y * h - size / 2 + Math.sin(time * 0.13 + f.phase) * h * 0.02
        ctx.globalAlpha = storm.fog * 0.34
        ctx.drawImage(fogCool, x, y, size, size)
      }
      ctx.globalAlpha = 1
    }

    // snow
    if (storm.snow > 0.004) {
      const lit = Math.ceil(flakes.length * Math.min(storm.snow * 1.15, 1))
      for (let i = 0; i < lit; i++) {
        const f = flakes[i]
        f.y += f.speed * dt * (1 + storm.gust * 0.9)
        f.x += (windNow * 0.09 * f.depth + Math.sin(time * 0.7 + f.phase) * 0.008) * dt
        if (f.y > 1.06) { f.y = -0.06; f.x = Math.random() }
        if (f.x > 1.08) f.x -= 1.16
        if (f.x < -0.08) f.x += 1.16
        ctx.globalAlpha = f.alpha * Math.min(storm.snow * 1.3, 1) * (0.45 + f.depth * 0.55)
        // strong wind streaks the near flakes sideways
        const stretch = 1 + Math.abs(windNow) * storm.gust * 2.2 * f.depth
        ctx.drawImage(ashSprite, f.x * w - (f.size * stretch) / 2, f.y * h - f.size / 2, f.size * stretch, f.size)
      }
      ctx.globalAlpha = 1
    }

    // ice dust — tiny glints hanging in the air
    if (storm.ice > 0.004) {
      ctx.globalCompositeOperation = 'lighter'
      for (const p of ice) {
        p.x += p.drift * dt + windNow * 0.012 * dt
        p.y += p.rise * dt
        if (p.y < -0.04) p.y = 1.04
        if (p.y > 1.04) p.y = -0.04
        if (p.x > 1.04) p.x -= 1.08
        if (p.x < -0.04) p.x += 1.08
        const tw = 0.5 + Math.sin(time * p.twinkle + p.phase) * 0.5
        ctx.globalAlpha = storm.ice * tw * 0.8
        ctx.drawImage(ashSprite, p.x * w - 1.6, p.y * h - 1.6, 3.2, 3.2)
      }
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
    }
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
