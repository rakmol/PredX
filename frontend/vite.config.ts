import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { spawn } from 'child_process'

// Vite plugin: spawns the backend dev server alongside the frontend.
// The backend process is killed automatically when Vite exits.
function backendPlugin() {
  let proc: ReturnType<typeof spawn> | null = null
  return {
    name: 'start-backend',
    configureServer() {
      const backendDir = path.resolve(__dirname, '../backend')
      proc = spawn('npm', ['run', 'dev'], {
        cwd: backendDir,
        shell: true,
        stdio: 'inherit',
      })
      proc.on('error', (err) => console.error('[backend]', err.message))
    },
    closeBundle() {
      proc?.kill()
    },
  }
}

const isDev = process.env.NODE_ENV !== 'production'

export default defineConfig({
  plugins: [react(), tailwindcss(), ...(isDev ? [backendPlugin()] : [])],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['html2canvas'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
