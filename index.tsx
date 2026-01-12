/**
 * @authors Huynh and Hue
 * index.tsx - Entry point của ứng dụng React
 * Khởi tạo và render App component vào DOM
 */

import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

// Lấy phần tử root từ DOM
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Tạo root và render App trong StrictMode (kiểm tra lỗi development)
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
