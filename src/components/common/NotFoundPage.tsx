import React, { useEffect } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export interface NotFoundPageProps {
  onReturnHome?: () => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onReturnHome }) => {
  const currentPath = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/unknown';

  const handleReturn = () => {
    if (onReturnHome) {
      onReturnHome();
    } else {
      window.location.href = '/';
    }
  };

  useEffect(() => {
    const originalTitle = document.title;
    document.title = '404 // Route Not Found — CodeMyPicture';

    const robotsMeta = document.querySelector('meta[name="robots"]');
    const originalRobots = robotsMeta ? robotsMeta.getAttribute('content') : null;
    if (robotsMeta) {
      robotsMeta.setAttribute('content', 'noindex, nofollow');
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        handleReturn();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.title = originalTitle;
      if (robotsMeta && originalRobots) {
        robotsMeta.setAttribute('content', originalRobots);
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--ink)' }}>
      {/* Atelier Header */}
      <header className="v4-header studio-header-unified" role="banner">
        <div className="v4-header__left">
          <div
            className="v4-wordmark"
            onClick={handleReturn}
            role="button"
            tabIndex={0}
            title="CodeMyPicture Homepage"
          >
            CodeMy<em className="v4-wordmark-face">Picture</em>
          </div>
        </div>

        <div className="v4-header__right">
          <div className="studio-header-status-badge mono" style={{ borderColor: 'rgba(255, 79, 46, 0.3)', color: 'var(--vermilion)' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--vermilion)', display: 'inline-block' }} />
            <span>404 // NOT_FOUND</span>
          </div>
        </div>
      </header>

      {/* Main Terminal Frame */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <section
          style={{
            width: '100%',
            maxWidth: '680px',
            backgroundColor: 'var(--ink-2)',
            border: '1px solid var(--line)',
            borderRadius: '4px',
            boxShadow: '0 16px 48px rgba(0, 0, 0, 0.6)',
            overflow: 'hidden',
          }}
          aria-labelledby="not-found-heading"
        >
          <div
            style={{
              backgroundColor: '#0E0C0B',
              borderBottom: '1px solid var(--line)',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', gap: '6px' }} aria-hidden="true">
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5F56' }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFBD2E' }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#27C93F' }} />
            </div>
            <span className="mono" style={{ fontSize: '11px', color: 'var(--paper-dim)', letterSpacing: '0.05em' }}>
              atelier://kernel/route_exception.sh
            </span>
            <span style={{ width: '42px' }} />
          </div>

          <div style={{ padding: '32px 36px' }}>
            <div className="mono" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--vermilion)', letterSpacing: '0.08em', marginBottom: '8px' }}>
              [DIAGNOSTIC] ERROR 404
            </div>

            <h1
              id="not-found-heading"
              style={{ fontSize: '26px', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.25, marginBottom: '12px', color: 'var(--paper)' }}
            >
              Requested Path Does Not Exist
            </h1>

            <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--paper-dim)', marginBottom: '24px' }}>
              The route or asset you navigated to was not found on this server. CodeMyPicture runs 100% locally in your browser memory using WebAssembly and Web Workers.
            </p>

            <div
              className="mono"
              style={{
                backgroundColor: '#0B0A09',
                border: '1px solid var(--line)',
                borderLeft: '2px solid var(--vermilion)',
                borderRadius: '2px',
                padding: '16px 20px',
                fontSize: '12px',
                lineHeight: 1.7,
                color: 'var(--paper-dim)',
                marginBottom: '28px',
                overflowX: 'auto',
              }}
            >
              <div style={{ color: 'var(--paper-muted)' }}>// System execution diagnostics</div>
              <div>STATUS: <span style={{ color: 'var(--rose)', fontWeight: 500 }}>404 NOT FOUND</span></div>
              <div>REQUEST_URI: <span style={{ color: 'var(--vermilion)' }}>{currentPath}</span></div>
              <div>CLIENT_HOST: <span>codemypicture.netlify.app</span></div>
              <div>RUNTIME: <span style={{ color: 'var(--moss)' }}>In-Browser WASM & Web Workers</span></div>
              <div>MEM_STATE: <span>Zero cloud footprint (Local-first)</span></div>
              <div style={{ color: 'var(--paper-muted)' }}>// Recommended resolution: return to photo input workspace</div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="v4-btn v4-btn--accent"
                onClick={handleReturn}
                style={{ height: '38px', padding: '0 18px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <ArrowLeft size={14} />
                <span>Return to Studio Homepage</span>
              </button>
            </div>

            <span className="mono" style={{ fontSize: '11px', color: 'var(--paper-muted)', marginTop: '20px', display: 'block' }}>
              Shortcut: Press <kbd style={{ padding: '1px 6px', border: '1px solid var(--line)', background: 'var(--ink)', borderRadius: '2px', fontSize: '10px' }}>Esc</kbd> or <kbd style={{ padding: '1px 6px', border: '1px solid var(--line)', background: 'var(--ink)', borderRadius: '2px', fontSize: '10px' }}>Enter</kbd> to return home.
            </span>
          </div>
        </section>
      </main>

      {/* Atelier Footer */}
      <footer style={{ borderTop: '1px solid var(--line)', backgroundColor: 'var(--ink-2)', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--paper-muted)' }}>
        <span>CodeMyPicture Atelier Vision Laboratory</span>
        <div className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--moss)' }}>
          <ShieldCheck size={13} />
          <span>100% In-Browser Privacy</span>
        </div>
      </footer>
    </div>
  );
};
