import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LayoutDashboard, Leaf, Home, Wrench, Sparkles, Menu, X } from 'lucide-react';
import LoginPage from './pages/LoginPage';
import Overview from './pages/Overview';
import TeaPage from './pages/TeaPage';
import RentalsPage from './pages/RentalsPage';
import AdminPage from './pages/AdminPage';
import HomesPage from './pages/HomesPage';
import InsightsPage from './pages/InsightsPage';
import Sidebar from './components/layout/Sidebar';
import './styles/global.css';
import V2App from './v2/App2';
import { createFirestoreStore } from './v2/data/firestoreStore';

// The new screens. They read and write their own collections (fo_*); the old
// pages below stay available under "the old app" for comparing figures.
function NewApp({ user, role, onLogout, onClassic }) {
  const store = React.useMemo(() => createFirestoreStore({
    by: user.email || user.uid,
    onError: (err) => window.dispatchEvent(new CustomEvent('v2-error', { detail: err })),
  }), [user.email, user.uid]);
  return <V2App store={store} user={user} role={role} onLogout={onLogout} onClassic={onClassic} />;
}

const BOTTOM_NAV = [
  { label: 'Overview', icon: LayoutDashboard, path: '/' },
  { label: 'Tea',      icon: Leaf,            path: '/tea' },
  { label: 'Rentals',  icon: Home,            path: '/rentals' },
  { label: 'Homes',    icon: Wrench,          path: '/homes' },
  { label: 'Insights', icon: Sparkles,        path: '/insights' },
];

function AppShell() {
  const { user, loading, role, logout } = useAuth();
  const [classic, setClassic]     = useState(() => window.location.hash.startsWith('#/classic'));
  const [page, setPage]           = useState('/');
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--bg)',
        flexDirection: 'column', gap: 16,
      }}>
        <div style={{ fontSize: '1.4rem', color: 'var(--accent)' }}>Family Office</div>
        <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Loading…</div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  if (!classic) {
    return <NewApp user={user} role={role} onLogout={logout}
      onClassic={() => { window.location.hash = '#/classic'; setClassic(true); }} />;
  }

  const navigate = (p) => { setPage(p); setMobileOpen(false); };

  const PageContent = () => {
    switch (page) {
      case '/':       return <Overview />;
      case '/tea':    return <TeaPage />;
      case '/rentals':return <RentalsPage />;
      case '/admin':  return <AdminPage />;
      case '/homes':  return <HomesPage />;
      case '/insights': return <InsightsPage />;
      default:        return <Overview />;
    }
  };

  return (
    <div className="app-shell">
      <button
        onClick={() => { window.location.hash = '#/'; setClassic(false); }}
        style={{
          position: 'fixed', top: 10, right: 12, zIndex: 500, background: '#1F6B45', color: '#fff',
          border: 0, borderRadius: 8, padding: '8px 14px', fontWeight: 600, cursor: 'pointer',
        }}
      >
        Back to the new app
      </button>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 299,
          }}
        />
      )}

      {/* Mobile hamburger button */}
      <button
        className="mobile-menu-btn"
        onClick={() => setMobileOpen(o => !o)}
        style={{
          position: 'fixed', top: 14, left: 14, zIndex: 400,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, padding: 8, cursor: 'pointer',
          color: 'var(--text)', display: 'none',
        }}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      <Sidebar
        active={page}
        onNavigate={navigate}
        mobileOpen={mobileOpen}
        onToggleMobile={() => setMobileOpen(o => !o)}
      />

      <main className="main-content">
        <PageContent />
      </main>

      {/* Bottom navigation — mobile only, shown via CSS */}
      <nav className="mobile-bottom-nav">
        {BOTTOM_NAV.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              className={`mobile-nav-item ${page === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

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
