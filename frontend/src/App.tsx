import { Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';

import Navbar from '@/components/layout/Navbar';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import { useAuthStore } from '@/store/authStore';
import { getCurrentUser, onAuthStateChange } from '@/lib/supabase';

// Auth pages (no navbar)
import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import ForgotPassword from '@/pages/auth/ForgotPassword';

// App pages
import Markets from '@/pages/Markets';
import Predict from '@/pages/Predict';
import InvestmentAdvisor from '@/pages/app/InvestmentAdvisor';
import CoinDetail from '@/pages/app/CoinDetail';
import Dashboard from '@/pages/app/Dashboard';
import Portfolio from '@/pages/app/Portfolio';
import Alerts from '@/pages/app/Alerts';
import Pricing from '@/pages/Pricing';
import Upgrade from '@/pages/app/Upgrade';
import Settings from '@/pages/app/Settings';
import CoinPage from '@/pages/CoinPage';
import LandingPage from '@/pages/landing/LandingPage';

const NO_NAVBAR = ['/login', '/signup', '/forgot-password', '/'];
const isPublicCoinPage = (path: string) => path.startsWith('/c/');

function Layout() {
  const location = useLocation();
  const showNav = !NO_NAVBAR.includes(location.pathname) && !isPublicCoinPage(location.pathname);

  return (
    <div className="min-h-screen bg-[#050A14]">
      {showNav && <Navbar />}
      <main>
        <Routes>
          {/* Root landing page */}
          <Route path="/" element={<LandingPage />} />
          {/* Public */}
          <Route path="/markets"        element={<Markets />} />
          <Route path="/pricing"        element={<Pricing />} />
          <Route path="/c/:coinId"      element={<CoinPage />} />
          <Route path="/login"          element={<Login />} />
          <Route path="/signup"         element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Protected */}
          <Route path="/predict"        element={<ProtectedRoute><Predict /></ProtectedRoute>} />
          <Route path="/predict/:coinId" element={<ProtectedRoute><Predict /></ProtectedRoute>} />
          <Route path="/dashboard"      element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/coin/:coinId"   element={<ProtectedRoute><CoinDetail /></ProtectedRoute>} />
          <Route path="/advisor"        element={<ProtectedRoute><InvestmentAdvisor /></ProtectedRoute>} />
          <Route path="/portfolio"      element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
          <Route path="/alerts"         element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
          <Route path="/upgrade"        element={<ProtectedRoute><Upgrade /></ProtectedRoute>} />
          <Route path="/settings"       element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const { login, logout, setLoading } = useAuthStore();

  // Restore session on first load
  useEffect(() => {
    getCurrentUser().then((result) => {
      if (result) login(result.profile, result.token);
      else setLoading(false);
    });

    const { data: { subscription } } = onAuthStateChange((_event, profile, token) => {
      if (profile && token) login(profile, token);
      else logout();
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#0D1526',
            color: '#E2E8F0',
            border: '1px solid #1E3050',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#22C55E', secondary: '#0D1526' } },
          error:   { iconTheme: { primary: '#EF4444', secondary: '#0D1526' } },
        }}
      />
      <Layout />
    </>
  );
}
