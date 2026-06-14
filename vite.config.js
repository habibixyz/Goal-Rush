import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import handler from './api/live.js'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'api-live-middleware',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url === '/api/live' || req.url?.startsWith('/api/live?')) {
            try {
              const mockRes = {
                status(statusCode) {
                  res.statusCode = statusCode;
                  return this;
                },
                json(data) {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(data));
                  return this;
                },
                setHeader(name, value) {
                  res.setHeader(name, value);
                  return this;
                }
              };
              await handler(req, mockRes);
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          } else {
            next();
          }
        });
      }
    }
  ],
})
