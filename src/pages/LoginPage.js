import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

export default function LoginPage() {
  const { loginWithGoogle, accessDenied } = useAuth();
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [popupBlocked, setPopupBlocked] = useState(false);

  const handleGoogle = async () => {
    setError('');
    setPopupBlocked(false);
    setLoading(true);
    try {
      await loginWithGoogle();
      // If we get here without error, onAuthStateChanged takes over
    } catch (e) {
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
        // User closed popup — no error message needed
        setError('');
      } else if (e.code === 'auth/popup-blocked') {
        setPopupBlocked(true);
      } else if (e.code === 'auth/network-request-failed') {
        setError('Network error. Check your connection and try again.');
      } else {
        setError('Sign-in failed (' + (e.code || e.message) + '). Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '20px',
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(201,168,76,0.1)',
            border: '1px solid rgba(201,168,76,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 18px', fontSize: '2rem',
          }}>🏡</div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.75rem',
            color: 'var(--accent)',
            fontWeight: 700,
            lineHeight: 1.2,
          }}>
            Family Office
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: 6 }}>
            Financial Management Portal
          </p>
        </div>

        {/* Access denied */}
        {accessDenied && (
          <div style={{
            background: 'rgba(224,92,92,0.08)',
            border: '1px solid rgba(224,92,92,0.3)',
            borderRadius: 'var(--radius)',
            padding: '14px 16px',
            marginBottom: 20,
            fontSize: '0.85rem',
            color: 'var(--danger)',
            lineHeight: 1.6,
          }}>
            <strong>Access not granted.</strong><br />
            Your Google account is not on the approved list.
            Contact the family admin to get access.
          </div>
        )}

        {/* Popup blocked fallback */}
        {popupBlocked && (
          <div style={{
            background: 'rgba(201,168,76,0.08)',
            border: '1px solid rgba(201,168,76,0.3)',
            borderRadius: 'var(--radius)',
            padding: '14px 16px',
            marginBottom: 20,
            fontSize: '0.85rem',
            color: 'var(--accent)',
            lineHeight: 1.7,
          }}>
            <strong>Pop-up was blocked.</strong><br />
            Please allow pop-ups for this site in your browser settings, then try again.<br />
            <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
              Chrome: Click the blocked pop-up icon in the address bar → Always allow
            </span>
          </div>
        )}

        {/* Sign-in card */}
        <div className="card" style={{ padding: '32px 28px', textAlign: 'center' }}>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: 24, lineHeight: 1.6 }}>
            This portal is private and accessible only to approved family members.
          </p>

          <button
            onClick={handleGoogle}
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: '11px 20px',
              background: '#fff',
              color: '#1f1f1f',
              border: '1px solid #dadce0',
              borderRadius: 8,
              fontSize: '0.9rem',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'box-shadow 0.15s',
              fontFamily: 'var(--font-body)',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            <GoogleIcon />
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>

          {error && (
            <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: 14 }}>
              {error}
            </p>
          )}
        </div>

        <p style={{
          textAlign: 'center',
          color: 'var(--muted)',
          fontSize: '0.72rem',
          marginTop: 24,
          lineHeight: 1.6,
        }}>
          Access is by invitation only.<br />
          Your Google account must be pre-approved by an admin.
        </p>
      </div>
    </div>
  );
}
