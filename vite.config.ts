/**
 * @authors Huynh and Hue
 * vite.config.ts - Cấu hình Vite build tool
 */

import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  return {
    // Cấu hình server development
    server: {
      port: 3000, // Cổng chạy server
      host: "0.0.0.0", // Cho phép truy cập từ mạng LAN
    },
    // Plugins: React và Tailwind CSS
    plugins: [react(), tailwindcss()],
    // Cấu hình alias đường dẫn
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."), // @ = thư mục gốc
      },
    },
  };
});
