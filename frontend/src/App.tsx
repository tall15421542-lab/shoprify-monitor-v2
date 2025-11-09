import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import StoresPage from './pages/StoresPage';
import ProductsPage from './pages/ProductsPage';
import DashboardPage from './pages/DashboardPage';
import ChangelogPage from './pages/ChangelogPage';
import { ToastProvider } from './components/common/ToastContainer';

function App() {
  return (
    <ToastProvider>
      <Router>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/stores" replace />} />
            <Route path="stores" element={<StoresPage />} />
            <Route path="stores/:storeId/products" element={<ProductsPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="changelog" element={<ChangelogPage />} />
          </Route>
        </Routes>
      </Router>
    </ToastProvider>
  );
}

export default App;

