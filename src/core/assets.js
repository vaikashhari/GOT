/**
 * Folder-driven asset discovery.
 *
 * Drop files into /assets/<role>/ and they are picked up automatically:
 *
 *   assets/intro/   -> title reveal video (scroll-scrubbed)
 *   assets/world/   -> world introduction video (scroll-scrubbed)
 *   assets/jon/     -> Jon Snow chapter video (scroll-scrubbed)
 *   assets/dany/    -> Daenerys chapter video (scroll-scrubbed)
 *   assets/logo/    -> site logo (svg preferred)
 *   assets/hero/    -> hero background layers (multiple files = parallax
 *                      layers, sorted by filename, first = deepest)
 *   assets/ui/      -> ui imagery, looked up by filename (e.g. dragon.png)
 *   assets/audio/   -> ambient audio (enables the sound toggle)
 *
 * Images are bundled directly. Video and audio ship only as the optimized
 * derivatives that scripts/prepare-assets.mjs mirrors into assets/.web/ —
 * raw sources (a 25MB ProRes .mov, say) never reach a production build.
 * In dev, if the pipeline hasn't run (no ffmpeg), raw files are served
 * as-is so the site still works.
 *
 * Files prefixed with "_" are treated as samples and lose to any other file.
 */

const IMAGES = import.meta.glob(
  '/assets/**/*.{png,jpg,jpeg,webp,avif,svg,gif}',
  { eager: true, query: '?url', import: 'default' },
)

// fast-glob skips dot-directories for wildcard segments, so .web needs its
// own explicit pattern.
const WEB = import.meta.glob(
  '/assets/.web/**/*.{mp4,webm,webp,png,jpg,jpeg,m4a,mp3,ogg,aac}',
  { eager: true, query: '?url', import: 'default' },
)

const MANIFEST_MOD = import.meta.glob('/assets/.web/manifest.json', { eager: true, import: 'default' })
const manifest = Object.values(MANIFEST_MOD)[0] || {}

// Dev-only: enumerate raw video/audio so the experience runs even before the
// pipeline ever has. This branch is dead-code-eliminated from builds, so the
// heavy sources are never emitted to dist.
let rawHeavyPaths = []
if (import.meta.env.DEV) {
  rawHeavyPaths = Object.keys(import.meta.glob(
    '/assets/**/*.{mp4,mov,m4v,webm,avi,mkv,mp3,m4a,aac,ogg,wav,flac}',
    { query: '?url', import: 'default' },
  ))
}

const VIDEO_RE = /\.(mp4|mov|m4v|webm|avi|mkv)$/i
const IMAGE_RE = /\.(png|jpg|jpeg|webp|avif|svg|gif)$/i
const AUDIO_RE = /\.(mp3|m4a|aac|ogg|wav|flac)$/i

/** '/assets/intro/intro.mov' -> 'intro/intro.mov' */
const relOf = (path) => path.replace(/^\/assets\//, '')

// manifest paths are relative to /assets (derivatives already carry .web/)
const webUrlFor = (webRel) => WEB[`/assets/${webRel}`] || null

const sampleAware = (a, b) => {
  // real files beat "_sample" files; then alphabetical for stable layering
  const sa = a.split('/').pop().startsWith('_') ? 1 : 0
  const sb = b.split('/').pop().startsWith('_') ? 1 : 0
  return sa - sb || a.localeCompare(b)
}

/** All known source paths ('/assets/...') for a folder, best first. */
function candidatesIn (folder, matcher) {
  const fromImages = Object.keys(IMAGES)
  const fromManifest = Object.keys(manifest).map(rel => `/assets/${rel}`)
  const pool = new Set([...fromImages, ...fromManifest, ...rawHeavyPaths])
  return [...pool]
    .filter(p => p.startsWith(`/assets/${folder}/`) && matcher.test(p))
    .sort(sampleAware)
}

/**
 * Resolve one source path into its best deliverable form: the optimized
 * derivative when the pipeline produced one, the raw file otherwise.
 */
function resolve (rawPath) {
  const rel = relOf(rawPath)
  const entry = manifest[rel]
  const out = {
    src: IMAGES[rawPath] || null,
    rel,
    meta: entry?.meta || null,
    poster: entry?.poster ? webUrlFor(entry.poster) : null,
    still: entry?.still ? webUrlFor(entry.still) : null,
  }
  if (entry?.out && entry.out !== rel) {
    out.src = webUrlFor(entry.out) || out.src
  }
  if (!out.src && import.meta.env.DEV) {
    // pipeline hasn't processed it — the dev server serves the raw file
    out.src = rawPath
  }
  return out
}

function firstIn (folder, matcher) {
  const found = candidatesIn(folder, matcher)
  return found.length ? resolve(found[0]) : null
}

export const assets = {
  introVideo: firstIn('intro', VIDEO_RE),
  worldVideo: firstIn('world', VIDEO_RE),
  jonVideo: firstIn('jon', VIDEO_RE),
  danyVideo: firstIn('dany', VIDEO_RE),
  // the finale: a backdrop film, an optional dragon-fire film (any video
  // named dragon*), and an optional roar (any audio file in the folder)
  endingVideo: (() => {
    const all = candidatesIn('ending', VIDEO_RE).filter(p => !/dragon/i.test(p.split('/').pop()))
    return all.length ? resolve(all[0]) : null
  })(),
  endingDragon: (() => {
    const all = candidatesIn('ending', VIDEO_RE).filter(p => /dragon/i.test(p.split('/').pop()))
    return all.length ? resolve(all[0]) : null
  })(),
  endingRoar: firstIn('ending', AUDIO_RE),
  epilogueVideo: firstIn('epilogue', VIDEO_RE),
  logo: (() => {
    // svg preferred for crispness, then anything else
    const all = candidatesIn('logo', IMAGE_RE)
    const svg = all.find(p => p.endsWith('.svg'))
    return svg ? resolve(svg) : (all.length ? resolve(all[0]) : null)
  })(),
  heroLayers: candidatesIn('hero', IMAGE_RE).map(resolve),
  ui: Object.fromEntries(
    candidatesIn('ui', IMAGE_RE).map(p => [p.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase(), resolve(p)]),
  ),
  ambience: firstIn('audio', AUDIO_RE),
}

if (import.meta.env.DEV) {
  console.info('[assets]', JSON.stringify({
    introVideo: assets.introVideo?.src || '(none)',
    worldVideo: assets.worldVideo?.src || '(none)',
    jonVideo: assets.jonVideo?.src || '(none)',
    danyVideo: assets.danyVideo?.src || '(none)',
    endingVideo: assets.endingVideo?.src || '(none)',
    endingDragon: assets.endingDragon?.src || '(none — procedural fire burst)',
    endingRoar: assets.endingRoar?.src || '(none)',
    epilogueVideo: assets.epilogueVideo?.src || '(none)',
    logo: assets.logo?.src || '(none — wordmark fallback)',
    heroLayers: assets.heroLayers.length,
    ui: Object.keys(assets.ui),
    ambience: assets.ambience?.src || '(none)',
  }))
}
