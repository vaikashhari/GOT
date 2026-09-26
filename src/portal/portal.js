/**
 * The portal — the crossing from the real world into Westeros.
 *
 * A full-screen WebGL fragment shader renders an organic liquid of ink and
 * ember-light that grows out of the button (its edge warped by fractal
 * noise, its rim molten, sparks living in the glow), swallows the screen,
 * and then tears open again from the centre to reveal the world already
 * waiting beneath. While the screen is fully covered, the page silently
 * travels to the world section — the visitor never sees a navigation,
 * only a crossing.
 *
 * Everything is procedural: no textures, no libraries, one draw call.
 * If WebGL is unavailable, an organic canvas-2D ink-blot takes over; under
 * prefers-reduced-motion the crossing is a calm, brief darkness.
 */
import { gsap } from '../core/scroll.js'
import { quality, reducedMotion } from '../core/quality.js'

const VERT = `
attribute vec2 a_pos;
void main () { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

const FRAG = `
precision highp float;

uniform vec2  u_res;
uniform vec2  u_center;   // portal origin in device pixels
uniform float u_t;        // 0..1 cover grows from button, 1..2 hole opens
uniform float u_time;     // seconds, keeps the edges alive

float hash (vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise (vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i),                 hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm (vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(19.7, 7.3);
    a *= 0.5;
  }
  return v;
}

void main () {
  vec2 px = gl_FragCoord.xy;
  vec2 uv = px / u_res.y; // aspect-correct noise space

  // shared organic fields
  float n1 = fbm(uv * 3.0 + vec2(u_time * 0.06, -u_time * 0.04));
  float n2 = fbm(uv * 7.0 - vec2(u_time * 0.09, u_time * 0.05));

  // ---- act one: the liquid grows out of the button -----------------------
  float tc = clamp(u_t, 0.0, 1.0);
  vec2 farC = max(u_center, u_res - u_center);
  float maxD = length(farC) * 1.12;
  float R = pow(tc, 1.55) * maxD;
  float d = length(px - u_center);
  float warp = (n1 - 0.5) * (90.0 + 300.0 * tc) + (n2 - 0.5) * 70.0;
  float dw = d + warp;
  float feather = 60.0 + 150.0 * tc;
  float cover = 1.0 - smoothstep(R - feather, R + feather * 0.35, dw);

  // ---- act two: the world tears open from the centre ---------------------
  float to = clamp(u_t - 1.0, 0.0, 1.0);
  float d2 = length(px - u_res * 0.5);
  float warp2 = (n1 - 0.5) * (130.0 + 340.0 * to) + (n2 - 0.5) * 80.0;
  float R2 = pow(to, 1.35) * (length(u_res * 0.5) * 1.2 + 240.0);
  float feather2 = 90.0 + 190.0 * to;
  float hole = 1.0 - smoothstep(R2 - feather2, R2 + feather2 * 0.4, d2 + warp2);

  float mask = cover * (1.0 - hole);

  // ---- the body of the liquid: deep ink, drifting smoke, gold veins ------
  // (derived from the two fields already computed — no extra fbm calls)
  float smoke = mix(n1, n2, 0.35);
  vec3 ink = vec3(0.014, 0.013, 0.020) + smoke * vec3(0.045, 0.04, 0.05);
  float veins = pow(1.0 - abs(2.0 * n2 - 1.0), 7.0);
  ink += veins * vec3(0.10, 0.055, 0.02) * (0.4 + 0.6 * tc) * (1.0 - to);

  // ---- molten rims --------------------------------------------------------
  float rimC = smoothstep(R - feather * 1.6, R - feather * 0.2, dw) * cover;
  float rimO = smoothstep(R2 - feather2 * 1.7, R2 - feather2 * 0.2, d2 + warp2) * hole;
  float rim = max(rimC * (1.0 - to * 0.85), rimO);
  vec3 emberCol = mix(vec3(1.0, 0.55, 0.16), vec3(1.0, 0.85, 0.5), n1);
  vec3 col = ink + emberCol * rim * 0.9;

  // sparks living in the glow
  float sparkField = noise(uv * 46.0 + vec2(u_time * 0.6, -u_time * 0.9));
  float sparks = step(0.982, sparkField) * rim;
  col += vec3(1.0, 0.9, 0.65) * sparks * 1.4;

  // light spilling ahead of the liquid edge
  float spillC = exp(-max(dw - R, 0.0) / 150.0) * (1.0 - cover) * (0.55 - 0.35 * to);
  float spillO = exp(-max(R2 - (d2 + warp2), 0.0) / 170.0) * hole * 0.35 * to;
  float spill = max(spillC, 0.0) + spillO;

  float alpha = clamp(mask + spill * 0.85, 0.0, 1.0);
  vec3 outCol = col * mask + emberCol * spill * 0.8;
  gl_FragColor = vec4(outCol, alpha);
}
`

// ---------------------------------------------------------------------------

function createGL (canvas) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false })
  if (!gl) return null

  const compile = (type, src) => {
    const sh = gl.createShader(type)
    gl.shaderSource(sh, src)
    gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn('[portal] shader error:', gl.getShaderInfoLog(sh))
      return null
    }
    return sh
  }
  const vs = compile(gl.VERTEX_SHADER, VERT)
  const fs = compile(gl.FRAGMENT_SHADER, FRAG)
  if (!vs || !fs) return null

  const prog = gl.createProgram()
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null
  gl.useProgram(prog)

  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'a_pos')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

  gl.enable(gl.BLEND)
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

  return {
    gl,
    uniforms: {
      res: gl.getUniformLocation(prog, 'u_res'),
      center: gl.getUniformLocation(prog, 'u_center'),
      t: gl.getUniformLocation(prog, 'u_t'),
      time: gl.getUniformLocation(prog, 'u_time'),
    },
  }
}

/** Organic 2D ink-blot fallback for the rare WebGL-less browser. */
function draw2DBlot (ctx, w, h, center, t, time) {
  ctx.clearRect(0, 0, w, h)
  const tc = Math.min(t, 1)
  const to = Math.max(t - 1, 0)
  const maxD = Math.hypot(Math.max(center.x, w - center.x), Math.max(center.y, h - center.y)) * 1.15
  const R = Math.pow(tc, 1.55) * maxD
  const R2 = Math.pow(to, 1.35) * (Math.hypot(w, h) * 0.62 + 200)

  const blob = (cx, cy, radius, seedBase, lobes) => {
    ctx.beginPath()
    for (let i = 0; i <= 42; i++) {
      const a = (i / 42) * Math.PI * 2
      const wob = 1 +
        0.16 * Math.sin(a * lobes + time * 0.9 + seedBase) +
        0.09 * Math.sin(a * (lobes * 2.3) - time * 1.3 + seedBase * 2.1)
      const r = radius * wob
      const x = cx + Math.cos(a) * r
      const y = cy + Math.sin(a) * r
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.closePath()
  }

  if (R > 2) {
    const g = ctx.createRadialGradient(center.x, center.y, Math.max(R * 0.5, 1), center.x, center.y, R * 1.1)
    g.addColorStop(0, 'rgba(6,6,10,0.985)')
    g.addColorStop(0.82, 'rgba(10,8,10,0.97)')
    g.addColorStop(0.94, 'rgba(212,128,44,0.85)')
    g.addColorStop(1, 'rgba(232,164,77,0)')
    ctx.fillStyle = g
    blob(center.x, center.y, R, 1.7, 5)
    ctx.fill()
  }
  if (R2 > 2) {
    ctx.globalCompositeOperation = 'destination-out'
    blob(w / 2, h / 2, R2, 4.2, 6)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  }
}

// ---------------------------------------------------------------------------

/**
 * initPortal({ button, coverDuration, revealDuration, onCovered, onOpen, onDone })
 * `onCovered` fires at full darkness — perform the silent travel there.
 */
export function initPortal ({ button, coverDuration = 1.25, revealDuration = 1.35, onCovered, onOpen, onDone }) {
  const host = document.getElementById('portal')
  const canvas = document.getElementById('portal-canvas')
  let running = false
  let glCtx = null
  let glTried = false

  // Compile the shader while the page is idle so the click itself never
  // pays the compilation cost.
  const warmUp = () => {
    if (glTried || reducedMotion) return
    glTried = true
    canvas.width = 8
    canvas.height = 8
    glCtx = createGL(canvas)
    if (glCtx) {
      // one tiny hidden draw so the driver JIT-compiles the pipeline now,
      // not on the first visible frame of the crossing
      const { gl, uniforms } = glCtx
      gl.viewport(0, 0, 8, 8)
      gl.uniform2f(uniforms.res, 8, 8)
      gl.uniform2f(uniforms.center, 4, 4)
      gl.uniform1f(uniforms.t, 0.5)
      gl.uniform1f(uniforms.time, 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      gl.finish()
    }
  }
  if (!reducedMotion) {
    'requestIdleCallback' in window ? requestIdleCallback(warmUp, { timeout: 4000 }) : setTimeout(warmUp, 1500)
  }

  return {
    enter () {
      if (running) return
      running = true

      // 1 · the button gathers its power
      button.classList.add('is-igniting')

      if (reducedMotion) {
        // a calm crossing: brief darkness, no spectacle
        const veil = document.createElement('div')
        veil.className = 'portal-calm-veil'
        document.body.appendChild(veil)
        gsap.timeline({
          onComplete: () => { veil.remove(); button.classList.remove('is-igniting'); running = false; onDone?.() },
        })
          .to(veil, { opacity: 1, duration: 0.45, ease: 'power1.in' })
          .add(() => onCovered?.())
          .to(veil, { opacity: 0, duration: 0.6, ease: 'power1.out' }, '+=0.15')
        return
      }

      // 2 · size the stage for the crossing
      warmUp() // no-op if the idle pre-compile already ran
      const dpr = Math.min(quality.dpr, 1.25)
      const w = Math.round(innerWidth * dpr)
      const h = Math.round(innerHeight * dpr)
      canvas.width = w
      canvas.height = h

      const rect = button.getBoundingClientRect()
      const center = {
        x: (rect.left + rect.width / 2) * dpr,
        y: (rect.top + rect.height / 2) * dpr,
      }

      const ctx2d = glCtx ? null : canvas.getContext('2d')
      const state = { t: 0 }
      const t0 = performance.now()
      let covered = false

      host.classList.add('is-active')

      const render = () => {
        const time = (performance.now() - t0) / 1000
        if (glCtx) {
          const { gl, uniforms } = glCtx
          gl.viewport(0, 0, w, h)
          gl.uniform2f(uniforms.res, w, h)
          // gl_FragCoord has y up; the center must flip
          gl.uniform2f(uniforms.center, center.x, h - center.y)
          gl.uniform1f(uniforms.t, state.t)
          gl.uniform1f(uniforms.time, time)
          gl.clearColor(0, 0, 0, 0)
          gl.clear(gl.COLOR_BUFFER_BIT)
          gl.drawArrays(gl.TRIANGLES, 0, 3)
        } else if (ctx2d) {
          draw2DBlot(ctx2d, w, h, center, state.t, time)
        }
      }

      gsap.ticker.add(render)

      gsap.timeline({
        onComplete: () => {
          gsap.ticker.remove(render)
          host.classList.remove('is-active')
          button.classList.remove('is-igniting')
          running = false
          onDone?.()
        },
      })
        // the liquid takes the screen
        .to(state, { t: 1, duration: coverDuration, ease: 'power2.in' }, 0.12)
        .add(() => {
          if (!covered) { covered = true; onCovered?.() }
        })
        // a beat of held darkness — the threshold between worlds
        .to(state, { t: 2, duration: revealDuration, ease: 'power3.out' }, `+=${0.22}`)
        .add(() => onOpen?.(), '<0.15')
    },
  }
}
