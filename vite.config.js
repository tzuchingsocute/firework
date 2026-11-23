import { defineConfig } from 'vite'
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { dependencies } from './package.json'

const wasmDirectory = `mediapipe/${dependencies['@mediapipe/tasks-vision']}/wasm/`
const wasmFiles = new Map(['vision_wasm_internal.js', 'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm'].map(name => [
  name, readFileSync(new URL(`./node_modules/@mediapipe/tasks-vision/wasm/${name}`, import.meta.url)),
]))

export default defineConfig(({ mode }) => ({
  plugins: [{
    name: 'mediapipe-runtime',
    configureServer(server) {
      server.middlewares.use(`${server.config.base}${wasmDirectory}`, (request, response, next) => {
        const name = request.url.split('?')[0].slice(1)
        const source = wasmFiles.get(name)
        if (!source) return next()
        response.setHeader('Content-Type', name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript')
        response.end(source)
      })
    },
    generateBundle() {
      for (const [name, source] of wasmFiles) {
        this.emitFile({ type: 'asset', fileName: wasmDirectory + name, source })
      }
    },
  }, {
    name: 'page-presentation',
    transformIndexHtml(html) {
      return html.replace('%APP_VIEW%', mode === 'pages' ? 'public' : 'debug')
        .replace('%CAMERA_LABEL%', mode === 'pages' ? '加载中...' : '开启摄像头')
        .replace('%CAMERA_BOOTSTRAP%', mode === 'pages'
          ? '<section class="viewer-controls" data-camera-bootstrap aria-label="摄像头控制"><button type="button" disabled>加载中...</button></section>'
          : '')
    },
  }, {
    name: 'surface-worker-development',
    configureServer(server) {
      for (const [route, entry] of [['/surface-worker.js', 'src/surface/perception.worker.js'],
        ['/hand-worker.js', 'src/hand/perception.worker.js']]) server.middlewares.use(route, async (_request, response) => {
        try {
          const result = await build({
            entryPoints: [entry], bundle: true,
            format: 'iife', platform: 'browser', write: false,
            define: { 'import.meta.env.BASE_URL': JSON.stringify(server.config.base) },
          })
          response.setHeader('Content-Type', 'text/javascript')
          response.end(result.outputFiles[0].text)
        } catch (error) {
          response.statusCode = 500
          response.end('throw new Error(' + JSON.stringify(error.message) + ')')
        }
      })
    },
  }],
}))
