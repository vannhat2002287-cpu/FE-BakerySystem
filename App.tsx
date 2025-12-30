import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider } from './src/store/StoreContext';
import Layout from '@/src/components/Layout';
import POS from '@/src/pages/POS';
import Dashboard from '@/src/pages/Dashboard';
import InventoryPage from '@/src/pages/Inventory';
import HistoryPage from '@/src/pages/History';

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
    </StoreProvider>
  );
}

export default App;