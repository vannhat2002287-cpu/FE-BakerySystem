/**
 * @authors Huynh and Hue
 * App.tsx - Component gốc của ứng dụng
 * Thiết lập routing, providers và layout chung
 */

import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { StoreProvider } from "./store/StoreContext";
import Layout from "./components/Layout";
import POS from "./pages/POS";
import Dashboard from "./pages/Dashboard";
import InventoryPage from "./pages/Inventory";
import HistoryPage from "./pages/History";
import { toastConfig } from "./config/toast";
import { initLocale } from "./utils/date";
import { useEffect } from "react";

function App() {
  useEffect(() => {
    initLocale();
  }, []);

  return (
    // StoreProvider: cung cấp global state cho toàn app
    <StoreProvider>
      {/* HashRouter: routing dạng hash, tương thích static hosting */}
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<POS />} /> {/* Trang bán hàng */}
            <Route path="/dashboard" element={<Dashboard />} /> {/* Thống kê */}
            <Route path="/inventory" element={<InventoryPage />} /> {/* Tồn kho */}
            <Route path="/history" element={<HistoryPage />} /> {/* Lịch sử */}
            <Route path="*" element={<Navigate to="/" replace />} /> {/* Redirect về trang chủ */}
          </Routes>
        </Layout>
      </HashRouter>
      {/* Hiển thị thông báo toast */}
      <Toaster {...toastConfig} />
    </StoreProvider>
  );
}

export default App;
