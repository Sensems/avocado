import UnoCSS from 'unocss/vite'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from 'path';

const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(),
    UnoCSS(),
  ],

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Timing-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Expose-Headers': 'Tauri-Custom-Header',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },

  // sass配置
  css: {
    preprocessorOptions: {
      scss: {
        // 配置scss全局变量
        // additionalData: '@import "./src/styles/variables.scss";'
      }
    }
  }
}))