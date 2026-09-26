/**
 * Pre-rendered particle sprites. Drawing tiny pre-baked radial gradients with
 * drawImage() is dramatically cheaper than per-particle gradients or
 * shadowBlur, which is what keeps thousands of draws per second smooth.
 */

function radialSprite (size, stops) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  for (const [offset, color] of stops) g.addColorStop(offset, color)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return c
}

/** Warm ember with a hot core and soft falloff (drawn with 'lighter'). */
export const emberSprite = radialSprite(48, [
  [0, 'rgba(255,236,200,1)'],
  [0.18, 'rgba(255,190,110,0.95)'],
  [0.45, 'rgba(232,120,44,0.42)'],
  [0.75, 'rgba(160,60,18,0.12)'],
  [1, 'rgba(120,40,10,0)'],
])

/** Cold pale mote for ash / snow dust. */
export const ashSprite = radialSprite(32, [
  [0, 'rgba(214,226,240,0.9)'],
  [0.5, 'rgba(180,198,220,0.35)'],
  [1, 'rgba(150,170,196,0)'],
])

/** Large soft fog blob — cool and warm variants, cross-faded by fogWarm. */
function fogSprite (r, g, b) {
  const size = 384
  const c = document.createElement('canvas')
  c.width = size; c.height = size
  const ctx = c.getContext('2d')
  // A few offset soft blobs so fog has body instead of a perfect circle
  const blobs = [
    [0.5, 0.5, 0.5, 0.55],
    [0.34, 0.42, 0.3, 0.4],
    [0.66, 0.6, 0.32, 0.38],
    [0.55, 0.34, 0.26, 0.3],
  ]
  for (const [x, y, radius, alpha] of blobs) {
    const grad = ctx.createRadialGradient(size * x, size * y, 0, size * x, size * y, size * radius)
    grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`)
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)
  }
  return c
}

export const fogCool = fogSprite(96, 118, 148)
export const fogWarmSprite = fogSprite(196, 138, 84)
