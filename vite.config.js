import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { basename, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, writeFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Custom Vite plugin: watches src/data/*.json and sends new file content
 * directly to the browser via a custom HMR event — no page reload, no fetch.
 */
function husDataApi() {
  return {
    name: 'hus-data-api',

    configureServer(server) {
      // POST /__api/tasks/update  — persist task status toggle to disk
      server.middlewares.use('/__api/tasks/update', (req, res, next) => {
        if (req.method !== 'POST') return next()

        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', () => {
          try {
            const { id, updates } = JSON.parse(body)
            const tasksPath = resolve(__dirname, 'src/data/tasks.json')
            const tasks = JSON.parse(readFileSync(tasksPath, 'utf-8'))

            const task = tasks.find((t) => t.id === id)
            if (!task) {
              res.writeHead(404, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Task not found' }))
              return
            }

            Object.assign(task, updates)

            // Set completedAt when marking done, clear when un-marking
            if (updates.status === 'done') {
              task.completedAt = new Date().toISOString().slice(0, 10)
              // Advance PDCA to Act
              if (task.pdca === 'Plan' || task.pdca === 'Do' || task.pdca === 'Check') {
                task.pdca = 'Act'
                task.pdcaUpdatedAt = new Date().toISOString().slice(0, 10)
              }
            } else if (updates.status) {
              delete task.completedAt
            }

            writeFileSync(tasksPath, JSON.stringify(tasks, null, 2) + '\n', 'utf-8')

            // Also recalculate linked project progress
            if (task.project) {
              const projPath = resolve(__dirname, 'src/data/projects.json')
              const projects = JSON.parse(readFileSync(projPath, 'utf-8'))
              const proj = projects.find((p) => p.id === task.project)
              if (proj) {
                const linked = tasks.filter((t) => t.project === proj.id)
                const done = linked.filter((t) => t.status === 'done').length
                proj.progress = Math.round((done / linked.length) * 100)
                writeFileSync(projPath, JSON.stringify(projects, null, 2) + '\n', 'utf-8')
              }
            }

            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true }))
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: e.message }))
          }
        })
      })
    },
  }
}

function husDataHmr() {
  return {
    name: 'hus-data-hmr',

    async handleHotUpdate({ file, read, server }) {
      if (!/\/src\/data\/[^/]+\.json$/.test(file)) return

      const filename = basename(file)
      const content  = await read()

      // Validate JSON before sending
      try {
        JSON.parse(content)
      } catch {
        server.hot.send({ type: 'error', err: { message: `[HUS] Invalid JSON in ${filename}`, stack: '' } })
        return []
      }

      console.log(`\x1b[36m[HUS]\x1b[0m data changed: \x1b[1m${filename}\x1b[0m`)

      server.hot.send({
        type: 'custom',
        event: 'hus:data-update',
        data: { file: filename, content },
      })

      // Return [] to suppress Vite's default full-reload for this file
      return []
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), husDataApi(), husDataHmr()],
  server: {
    // Proxy /api to Vercel dev server (run `vercel dev` on port 3000 alongside `vite`)
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
