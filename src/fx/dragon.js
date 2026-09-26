/**
 * The dragon shadow that glides across the fire scene — deliberately soft,
 * blurred and brief: a presence, not a mascot.
 *
 * Drop a `dragon.svg` / `dragon.png` silhouette into assets/ui/ to use your
 * own artwork; otherwise the built-in silhouette is used.
 */
import { assets } from '../core/assets.js'

const BUILT_IN = `
<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path fill="currentColor" d="
    M 226 34
    C 222 30 214 28 208 30
    L 196 26 C 198 30 200 33 204 35
    C 188 38 168 44 152 52
    C 148 34 132 14 108 6
    C 116 16 120 26 118 34
    C 106 28 90 26 78 30
    C 92 34 102 40 108 48
    C 96 46 82 48 74 54
    C 88 56 100 60 108 66
    C 84 64 58 74 40 94
    C 60 84 80 80 96 84
    C 76 96 62 114 58 132
    C 74 112 94 98 112 94
    C 120 92 126 88 132 82
    C 140 88 152 92 164 90
    C 158 84 154 78 154 70
    C 158 62 166 56 176 52
    C 186 48 200 44 210 44
    C 218 44 224 40 226 34
    Z" />
</svg>`

export function createDragon (container) {
  const el = document.createElement('div')
  el.className = 'dragon-shadow'
  el.setAttribute('aria-hidden', 'true')

  const art = assets.ui.dragon
  if (art) {
    const img = document.createElement('img')
    img.src = art.src
    img.alt = ''
    img.draggable = false
    el.appendChild(img)
  } else {
    el.innerHTML = BUILT_IN
  }

  container.appendChild(el)
  return el
}
