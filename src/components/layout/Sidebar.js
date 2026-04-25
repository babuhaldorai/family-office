import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Leaf, Home, FileText, TrendingUp,
  LogOut, Menu, X, Settings, Wrench,
} from 'lucide-react';

const NAV = [
  { section: 'Overview' },
  { label: 'Dashboard',      icon: LayoutDashboard, path: '/' },
  { label: 'Reports',        icon: FileText,         path: '/reports' },
  { label: 'YOY Comparison', icon: TrendingUp,       path: '/yoy' },
  { section: 'Tea Plantation' },
  { label: 'Tea Plantation', icon: Leaf,             path: '/tea' },
  { section: 'Rental Homes' },
  { label: 'Rental Homes',   icon: Home,             path: '/rentals' },
  { section: 'Home Renovation' },
  { label: 'Homes & Expenses', icon: Wrench,         path: '/homes' },
  { section: 'Admin', adminOnly: true },
  { label: 'User Management', icon: Settings,        path: '/admin', adminOnly: true },
];

export default function Sidebar({ active, onNavigate, mobileOpen, onToggleMobile }) {
  const { user, role, logout, isAdmin } = useAuth();
  const initial = (user?.displayName || user?.email || 'U')[0].toUpperCase();

  return (
    <>
      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }}
          onClick={onToggleMobile}
        />
      )}

      <button
        onClick={onToggleMobile}
        style={{
          position: 'fixed', top: 16, left: 16, zIndex: 200,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, padding: 8, cursor: 'pointer', color: 'var(--text)',
          display: 'none',
        }}
        className="mobile-menu-btn"
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="brand">Family Office</div>
          <div className="brand-sub">Financial Portal</div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item, i) => {
            if (item.adminOnly && !isAdmin) return null;
            if (item.section) {
              return (
                <div key={i} className="nav-section" style={{ marginTop: i > 0 ? 8 : 0 }}>
                  <div className="nav-section-label">{item.section}</div>
                </div>
              );
            }
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                className={`nav-item ${active === item.path ? 'active' : ''}`}
                onClick={() => { onNavigate(item.path); }}
              >
                <Icon className="icon" size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{initial}</div>
            <div>
              <div className="user-name">{user?.displayName || user?.email}</div>
              <div className="user-role">{role === 'admin' ? '⚡ Admin' : '👁 Viewer'}</div>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={logout}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </>
  );
}
