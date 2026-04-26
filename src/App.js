import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LayoutDashboard, Leaf, Home, Wrench } from 'lucide-react';
import LoginPage from './pages/LoginPage';
import Overview from './pages/Overview';
import TeaPage from './pages/TeaPage';
import RentalsPage from './pages/RentalsPage';
import AdminPage from './pages/AdminPage';
import HomesPage from './pages/HomesPage';
import Sidebar from './components/layout/Sidebar';
import './styles/global.css';

function AppShell() {
  const { user, loading } = useAuth();
  const [page, setPage]             = useState('/');
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--accent)' }}>
          Family Office
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Loading…</div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const navigate = (p) => { setPage(p); setMobileOpen(false); };

  const PageContent = () => {
    switch (page) {
      case '/':           return <Overview />;
      case '/tea':        return <TeaPage />;
      case '/rentals':    return <RentalsPage />;


      case '/admin':      return <AdminPage />;
      case '/homes':      return <HomesPage />;
      default:            return <Overview />;
    }
  };

  return (
    <div className="app-shell">
      <Sidebar
        active={page}
        onNavigate={navigate}
        mobileOpen={mobileOpen}
        onToggleMobile={() => setMobileOpen(o => !o)}
      />
      <main className="main-content">
        <PageContent />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
