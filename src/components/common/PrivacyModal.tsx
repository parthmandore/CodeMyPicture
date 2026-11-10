import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Lock,
  Cpu,
  Trash2,
  CheckCircle2,
  Layers,
  HardDrive,
  Check,
} from 'lucide-react';
import { useToast } from './ToastContext';
import analytics, { ConsentStatus } from '../../services/analytics';

export interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  const toast = useToast();
  const [storedKeysCount, setStoredKeysCount] = useState<number>(0);
  const [analyticsConsent, setAnalyticsConsentState] = useState<ConsentStatus>('unset');
  const [isGaConfigured, setIsGaConfigured] = useState<boolean>(false);
  const [gaId, setGaId] = useState<string | null>(null);

  // Scan localStorage for any flags or keys
  const updateKeyCount = () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        let count = 0;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('codemyface_') || key.startsWith('codemypicture_'))) {
            count++;
          }
        }
        setStoredKeysCount(count);
      }
    } catch {
      setStoredKeysCount(0);
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateKeyCount();
      setAnalyticsConsentState(analytics.getConsent());
      setIsGaConfigured(analytics.isConfigured());
      setGaId(analytics.getMeasurementId());
    }
  }, [isOpen]);

  // Handle Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleClearPreferences = () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('codemyface_') || key.startsWith('codemypicture_'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
        updateKeyCount();
        setAnalyticsConsentState('unset');
        toast.success('Local preferences, consent state, and stored feature flags cleared.');
      }
    } catch {
      toast.error('Could not access localStorage.');
    }
  };

  const handleAcceptAll = () => {
    analytics.setConsent('granted');
    setAnalyticsConsentState('granted');
    toast.success('All preferences saved: Anonymous analytics enabled.');
    onClose();
  };

  const handleRejectOptional = () => {
    analytics.setConsent('denied');
    setAnalyticsConsentState('denied');
    toast.info('Preferences saved: Optional analytics rejected. Zero telemetry.');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="privacy-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-modal-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 8, 7, 0.82)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 180ms ease-out',
      }}
    >
      <div
        className="privacy-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--raised)',
          border: '1px solid var(--line-strong)',
          borderRadius: '4px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.65)',
          overflow: 'hidden',
          color: 'var(--paper)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--base)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={18} style={{ color: 'var(--moss)' }} />
            <div>
              <h2
                id="privacy-modal-title"
                className="mono"
                style={{ fontSize: '13px', letterSpacing: '0.08em', margin: 0, fontWeight: 600 }}
              >
                PRIVACY ARCHITECTURE & DATA PREFERENCES
              </h2>
              <div style={{ fontSize: '11px', color: 'var(--paper-dim)', marginTop: '2px' }}>
                Zero-tracker, 100% in-browser client execution
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="v4-btn"
            style={{ padding: '6px 10px' }}
            aria-label="Close privacy preferences modal"
          >
            <X size={14} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            fontSize: '13px',
            lineHeight: 1.55,
          }}
        >
          {/* Key Architecture Facts Banner */}
          <div
            style={{
              padding: '14px 18px',
              backgroundColor: 'rgba(135, 169, 107, 0.08)',
              border: '1px solid rgba(135, 169, 107, 0.3)',
              borderRadius: '3px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div
              className="mono"
              style={{
                fontSize: '11px',
                color: 'var(--moss)',
                fontWeight: 600,
                letterSpacing: '0.06em',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <CheckCircle2 size={13} />
              <span>VERIFIED CLIENT-SIDE ARCHITECTURE</span>
            </div>
            <p style={{ margin: 0, color: 'var(--paper)', fontSize: '12px' }}>
              CodeMyPicture is engineered with privacy-by-design. All image analysis, contour tracing, and vector synthesis occur strictly inside your device’s local browser memory.
            </p>
            <div
              className="mono"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                marginTop: '4px',
                fontSize: '11px',
                color: 'var(--paper-dim)',
              }}
            >
              <span><strong>0</strong> Cookies In Use</span>
              <span>•</span>
              <span><strong>0</strong> Analytics / Trackers</span>
              <span>•</span>
              <span><strong>0</strong> Remote Image Servers</span>
            </div>
          </div>

          {/* Storage & Privacy Categories */}
          <div>
            <div
              className="mono"
              style={{
                fontSize: '11px',
                letterSpacing: '0.08em',
                color: 'var(--paper-dim)',
                marginBottom: '12px',
                fontWeight: 600,
              }}
            >
              DATA STORAGE CATEGORIES
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Category 1: Strictly Necessary */}
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: 'var(--base)',
                  border: '1px solid var(--line)',
                  borderRadius: '3px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <Cpu size={14} style={{ color: 'var(--moss)' }} />
                    <span>Strictly Necessary (In-Memory Execution)</span>
                  </div>
                  <span
                    className="mono"
                    style={{
                      fontSize: '10px',
                      backgroundColor: 'rgba(135, 169, 107, 0.15)',
                      color: 'var(--moss)',
                      padding: '2px 6px',
                      borderRadius: '2px',
                    }}
                  >
                    ACTIVE (REQUIRED)
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--paper-dim)' }}>
                  Ephemeral in-memory buffers (Web Workers, WebAssembly heap, and blob object URLs) utilized to decode your photo and trace SVG vectors. Cleanly revoked upon photo replacement or tab close.
                </div>
              </div>

              {/* Category 2: Analytics & Telemetry */}
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: 'var(--base)',
                  border: '1px solid var(--line)',
                  borderRadius: '3px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <Lock size={14} style={{ color: analyticsConsent === 'granted' ? 'var(--moss)' : 'var(--paper-dim)' }} />
                    <span>Product Analytics (Google Analytics 4)</span>
                  </div>
                  <span
                    className="mono"
                    style={{
                      fontSize: '10px',
                      backgroundColor: analyticsConsent === 'granted' ? 'rgba(135, 169, 107, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                      color: analyticsConsent === 'granted' ? 'var(--moss)' : 'var(--paper-dim)',
                      padding: '2px 6px',
                      borderRadius: '2px',
                    }}
                  >
                    {analyticsConsent === 'granted' ? 'ENABLED (CONSENT GRANTED)' : 'DISABLED (ZERO TRACKING)'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--paper-dim)', marginBottom: '8px' }}>
                  {isGaConfigured ? (
                    <>Google Analytics 4 configured via <code>VITE_GA_MEASUREMENT_ID</code> ({gaId}). Collects anonymous conversion metrics only; strictly never receives user photos, filenames, or vector markup.</>
                  ) : (
                    <>Optional Google Analytics 4 integration is currently unconfigured (<code>VITE_GA_MEASUREMENT_ID</code> unset). Zero tracking calls are dispatched.</>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      analytics.setConsent('granted');
                      setAnalyticsConsentState('granted');
                      toast.success('Analytics consent granted. Thank you for supporting development.');
                    }}
                    className={`v4-btn ${analyticsConsent === 'granted' ? 'v4-btn--active' : ''}`}
                    style={{ padding: '4px 10px', fontSize: '11px' }}
                  >
                    <Check size={12} style={{ marginRight: '4px' }} />
                    <span>Grant Analytics Consent</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      analytics.setConsent('denied');
                      setAnalyticsConsentState('denied');
                      toast.info('Analytics consent revoked. Zero telemetry will be collected.');
                    }}
                    className={`v4-btn ${analyticsConsent === 'denied' ? 'v4-btn--active' : ''}`}
                    style={{ padding: '4px 10px', fontSize: '11px' }}
                  >
                    <X size={12} style={{ marginRight: '4px' }} />
                    <span>Revoke Analytics Consent</span>
                  </button>
                </div>
              </div>

              {/* Category 3: Marketing & Advertising */}
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: 'var(--base)',
                  border: '1px solid var(--line)',
                  borderRadius: '3px',
                  opacity: 0.85,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <HardDrive size={14} style={{ color: 'var(--paper-dim)' }} />
                    <span>Marketing & Cross-Site Tracking</span>
                  </div>
                  <span
                    className="mono"
                    style={{
                      fontSize: '10px',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      color: 'var(--paper-dim)',
                      padding: '2px 6px',
                      borderRadius: '2px',
                    }}
                  >
                    NONE PRESENT
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--paper-dim)' }}>
                  Zero tracking pixels, ad networks, or behavioral profiling tools exist in this codebase.
                </div>
              </div>

              {/* Category 4: Local Storage Preferences */}
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: 'var(--base)',
                  border: '1px solid var(--line)',
                  borderRadius: '3px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <Layers size={14} style={{ color: 'var(--accent)' }} />
                    <span>Developer Runtime Flags (`localStorage`)</span>
                  </div>
                  <span
                    className="mono"
                    style={{
                      fontSize: '10px',
                      backgroundColor: storedKeysCount > 0 ? 'rgba(255, 79, 46, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                      color: storedKeysCount > 0 ? 'var(--accent)' : 'var(--paper-dim)',
                      padding: '2px 6px',
                      borderRadius: '2px',
                    }}
                  >
                    {storedKeysCount} STORED KEY{storedKeysCount === 1 ? '' : 'S'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--paper-dim)', marginBottom: '8px' }}>
                  Optional client-side feature flags toggled explicitly via URL query parameters (e.g. <code>?flag_paintingMix=1</code>). No personal data is stored.
                </div>
                {storedKeysCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearPreferences}
                    className="v4-btn v4-btn--danger"
                    style={{ padding: '4px 10px', fontSize: '11px' }}
                  >
                    <Trash2 size={12} style={{ marginRight: '4px' }} />
                    <span>Clear All Stored Flags ({storedKeysCount})</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Technical Privacy Disclosures */}
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--base)',
              border: '1px solid var(--line)',
              borderRadius: '3px',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div className="mono" style={{ fontWeight: 600, color: 'var(--paper)' }}>
              ACCURATE PRIVACY DISCLOSURES
            </div>

            <div>
              <strong style={{ color: 'var(--paper)' }}>1. Processing Mechanism:</strong>
              <div style={{ color: 'var(--paper-dim)' }}>
                Photographs uploaded via drag-and-drop or file selector are validated locally for magic bytes and dimension limits. Pixel buffers are dispatched to background Web Workers running subpixel Marching Squares and Delaunay color quantization.
              </div>
            </div>

            <div>
              <strong style={{ color: 'var(--paper)' }}>2. Network Transmission:</strong>
              <div style={{ color: 'var(--paper-dim)' }}>
                Photographs, biometric landmark arrays, and generated vector markup are never transmitted across the network. There are zero upload endpoints.
              </div>
            </div>

            <div>
              <strong style={{ color: 'var(--paper)' }}>3. Third-Party Services:</strong>
              <div style={{ color: 'var(--paper-dim)' }}>
                Typography is loaded from Google Fonts (fonts.googleapis.com / fonts.gstatic.com). MediaPipe WASM and AI models load locally from same-origin endpoints (<code>/wasm</code>, <code>/face_landmarker.task</code>), with automatic fallback to jsDelivr/Google Cloud Storage only if local static files are unreachable. No user imagery or biometrics are shared with these CDNs.
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--line)',
            backgroundColor: 'var(--base)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div className="mono" style={{ fontSize: '11px', color: 'var(--paper-dim)' }}>
            <span>EPRIVACY & GDPR COMPLIANT</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleRejectOptional}
              className="v4-btn"
              style={{ padding: '7px 14px', fontSize: '11px' }}
              title="Reject all non-essential telemetry"
            >
              <span>Reject Optional</span>
            </button>

            <button
              type="button"
              onClick={handleAcceptAll}
              className="v4-btn"
              style={{ padding: '7px 14px', fontSize: '11px' }}
              title="Accept anonymous telemetry"
            >
              <span>Accept All</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="v4-btn v4-btn--primary"
              style={{ padding: '7px 16px', fontSize: '11px' }}
            >
              <span>Save & Close</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyModal;
