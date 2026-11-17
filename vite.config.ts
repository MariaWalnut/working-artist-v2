import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Locally, serve /welcome the way vercel.json does on the live site.
const welcomeRewrite: Plugin = {
  name: 'welcome-rewrite',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url && /^\/welcome\/?(\?|#|$)/.test(req.url)) req.url = req.url.replace(/^\/welcome\/?/, '/welcome/index.html')
      next()
    })
  },
}

export default defineConfig({
  plugins: [welcomeRewrite, react(), tailwindcss()],
})
