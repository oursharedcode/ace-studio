import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" keeps every asset URL relative, so the same build works at
// https://oursharedcode.github.io/ace-studio/ and at
// https://www.oursharedcode.com/ace-studio/ without a rebuild.
//
// Ports are pinned away from Vite's defaults (5173/4173) because other
// projects on this machine use those and the numbers around them. strictPort
// makes a clash fail loudly instead of drifting onto another project's port.
// The visitor-counter Worker allows neither origin, so the map is blank locally.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { port: 5300, strictPort: true },
  preview: { port: 4300, strictPort: true },
});
