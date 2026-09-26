/**
 * Device capability tiers. Every performance-sensitive knob in the experience
 * reads from here so the site stays buttery on weak hardware and glorious on
 * strong hardware.
 */

const coarse = matchMedia('(pointer: coarse)').matches
const smallViewport = Math.min(screen.width, screen.height) < 760
const mem = navigator.deviceMemory || 8
const cores = navigator.hardwareConcurrency || 8
const saveData = navigator.connection?.saveData === true

// System preference, or the ?calm escape hatch for a still, quiet visit
export const reducedMotion =
  matchMedia('(prefers-reduced-motion: reduce)').matches ||
  new URLSearchParams(location.search).has('calm')

const tier = saveData || mem <= 2
  ? 'low'
  : (coarse || smallViewport)
    ? 'mobile'
    : (mem >= 8 && cores >= 8) ? 'high' : 'mid'

const PRESETS = {
  high: {
    dpr: Math.min(devicePixelRatio || 1, 2),
    ash: 90, emberMax: 130, fogSprites: 8,
    scrubFrames: 200, longScrubFrames: 440, scrubWidth: 1600, decodeWindow: 30, blend: true,
  },
  mid: {
    dpr: Math.min(devicePixelRatio || 1, 1.5),
    ash: 64, emberMax: 90, fogSprites: 6,
    scrubFrames: 160, longScrubFrames: 400, scrubWidth: 1440, decodeWindow: 24, blend: true,
  },
  mobile: {
    dpr: Math.min(devicePixelRatio || 1, 1.5),
    ash: 40, emberMax: 55, fogSprites: 4,
    scrubFrames: 110, longScrubFrames: 240, scrubWidth: 960, decodeWindow: 16, blend: false,
  },
  low: {
    dpr: 1,
    ash: 24, emberMax: 30, fogSprites: 3,
    scrubFrames: 72, longScrubFrames: 140, scrubWidth: 854, decodeWindow: 10, blend: false,
  },
}

export const quality = { tier, coarse, ...PRESETS[tier] }

// Particle/fog canvases are soft by nature — they never need more than
// ~1.4x pixel density, and full-screen fill-rate is precious on integrated
// GPUs. (Film canvases keep the full cap for sharpness.)
quality.fxDpr = Math.min(quality.dpr, 1.4)

if (import.meta.env.DEV) console.info('[quality]', quality)
