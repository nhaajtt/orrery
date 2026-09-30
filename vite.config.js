import { defineConfig } from 'vite';

// Serves api/gh.js during `npm run dev`, mirroring the Vercel function.
export default defineConfig({
  plugins: [
    {
      name: 'dev-api',
      configureServer(server) {
        server.middlewares.use('/api/gh', async (req, res) => {
          const url = new URL(req.url, 'http://local');
          const { default: handler } = await server.ssrLoadModule('/api/gh.js');
          const shim = {
            status(code) {
              res.statusCode = code;
              return shim;
            },
            setHeader: (k, v) => res.setHeader(k, v),
            json(body) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(body));
            },
          };
          await handler({ query: Object.fromEntries(url.searchParams), method: req.method }, shim);
        });
      },
    },
  ],
});
