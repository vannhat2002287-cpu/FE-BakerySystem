import React from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { StoreProvider } from "./store/StoreContext";
import Layout from "./components/Layout";
import POS from "./pages/POS";
import Dashboard from "./pages/Dashboard";
import InventoryPage from "./pages/Inventory";
import HistoryPage from "./pages/History";
import { toastConfig } from "./config/toast";

function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<POS />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </HashRouter>
      <Toaster {...toastConfig} />
    </StoreProvider>
  );
}

export default App;
