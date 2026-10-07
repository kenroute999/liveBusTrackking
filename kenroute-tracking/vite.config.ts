import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The backend only answers the KenRoute apps on their own ports; this one is 3004.
  server: { host: "127.0.0.1", port: 3004, strictPort: true },
});
