import { resolve } from "node:path";
import { defineConfig } from "vite";

const cleanUrls = (request: { url?: string }, _response: unknown, next: () => void) => {
  if ((request.url || "").split("?")[0] === "/app") request.url = "/app.html";
  next();
};

export default defineConfig({
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, "index.html"),
        app: resolve(import.meta.dirname, "app.html"),
      },
    },
  },
  plugins: [
    {
      // Vercel serves /app from app.html (cleanUrls). Mirror that locally.
      name: "raho-clean-urls",
      configureServer(server) {
        server.middlewares.use(cleanUrls);
      },
      configurePreviewServer(server) {
        server.middlewares.use(cleanUrls);
      },
    },
  ],
});
