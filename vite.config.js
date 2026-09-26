import { defineConfig } from 'vite'
import { spawn } from 'node:child_process'
import path from 'node:path'

/**
 * Re-runs the asset pipeline whenever a file inside /assets changes while the
 * dev server is running, then reloads the page. Dropping a new video, logo or
 * image into assets/ is all it takes — no code edits, no manual restart.
 */
function assetPipelinePlugin () {
  const assetsDir = path.resolve(__dirname, 'assets')
  const script = path.resolve(__dirname, 'scripts/prepare-assets.mjs')
  let running = false
  let queued = false
  let timer = null

  const runPipeline = (server) => {
    if (running) { queued = true; return }
    running = true
    const child = spawn(process.execPath, [script], { stdio: 'inherit' })
    child.on('exit', () => {
      running = false
      server.ws.send({ type: 'full-reload' })
      if (queued) { queued = false; runPipeline(server) }
    })
  }

  return {
    name: 'got-asset-pipeline',
    configureServer (server) {
      server.watcher.add(assetsDir)
      server.watcher.on('all', (_event, file) => {
        if (!file || !file.startsWith(assetsDir)) return
        if (file.includes(`${path.sep}.web${path.sep}`)) return // ignore our own output
        clearTimeout(timer)
        timer = setTimeout(() => runPipeline(server), 400)
      })
    },
  }
}

export default defineConfig({
  plugins: [assetPipelinePlugin()],
  server: { host: true },
  build: {
    target: 'es2020',
    assetsInlineLimit: 2048,
  },
})
