import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    hmr: {
      protocol: 'ws',
      host: '127.0.0.1',
      port: 5173,
    },
  },
  optimizeDeps: {
    include: ['@react-three/fiber', '@react-three/drei', 'three', 'react', 'react-dom'],
  },
});
