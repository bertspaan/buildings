import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, resolve } from 'node:path'

import devtoolsJson from 'vite-plugin-devtools-json'
import tailwindcss from '@tailwindcss/vite'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

const repoRoot = resolve(import.meta.dirname, '..')
const dataDir = resolve(repoRoot, 'data', 'r2')

export default defineConfig({
  ssr: {
    noExternal: ['maplibre-gl', 'maplibre-contour']
  },
  plugins: [
    tailwindcss(),
    sveltekit(),
    devtoolsJson(),
    {
      name: 'local-pmtiles-data',
      configureServer(server) {
        server.middlewares.use('/pmtiles', async (req, res, next) => {
          try {
            const requestPath = req.url?.split('?')[0] ?? '/'
            const relativePath = requestPath.replace(/^\/+/, '')
            const filePath = resolve(dataDir, relativePath)

            if (!filePath.startsWith(`${dataDir}/`) && filePath !== dataDir) {
              res.statusCode = 403
              res.end('Forbidden')
              return
            }

            const fileStat = await stat(filePath)
            const extension = extname(filePath).toLowerCase()
            const totalSize = fileStat.size
            const rangeHeader = req.headers.range

            if (extension === '.pmtiles') {
              res.setHeader('Content-Type', 'application/octet-stream')
            }

            res.setHeader('Accept-Ranges', 'bytes')
            res.setHeader('Cache-Control', 'no-store')

            if (req.method === 'HEAD') {
              res.statusCode = 200
              res.setHeader('Content-Length', totalSize)
              res.end()
              return
            }

            if (rangeHeader) {
              const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader)

              if (!match) {
                res.statusCode = 416
                res.setHeader('Content-Range', `bytes */${totalSize}`)
                res.end()
                return
              }

              const start = match[1] === '' ? 0 : Number.parseInt(match[1], 10)
              const end =
                match[2] === '' ? totalSize - 1 : Number.parseInt(match[2], 10)

              if (
                !Number.isFinite(start) ||
                !Number.isFinite(end) ||
                start < 0 ||
                end < start ||
                start >= totalSize
              ) {
                res.statusCode = 416
                res.setHeader('Content-Range', `bytes */${totalSize}`)
                res.end()
                return
              }

              const clampedEnd = Math.min(end, totalSize - 1)
              res.statusCode = 206
              res.setHeader(
                'Content-Range',
                `bytes ${start}-${clampedEnd}/${totalSize}`
              )
              res.setHeader('Content-Length', clampedEnd - start + 1)
              createReadStream(filePath, {
                start,
                end: clampedEnd
              }).pipe(res)
              return
            }

            res.statusCode = 200
            res.setHeader('Content-Length', totalSize)
            createReadStream(filePath).pipe(res)
          } catch {
            next()
          }
        })
      }
    }
  ]
})
