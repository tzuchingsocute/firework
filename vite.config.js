import { defineConfig } from 'vite'
import { build } from 'esbuild'

export default defineConfig({
  plugins: [{
    name: 'surface-worker-development',
    configureServer(server) {
      for (const [route, entry] of [['/surface-worker.js', 'src/surface/perception.worker.js'],
        ['/hand-worker.js', 'src/hand/perception.worker.js']]) server.middlewares.use(route, async (_request, response) => {
        try {
          const result = await build({
            entryPoints: [entry], bundle: true,
            format: 'iife', platform: 'browser', write: false,
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
})
