import React, { useState, useEffect } from 'react';
import { ShieldCheck, Check, X, Sliders } from 'lucide-react';
import analytics, { ConsentStatus } from '../../services/analytics';

export interface ConsentBannerProps {
  onOpenPreferences: () => void;
}

export const ConsentBanner: React.FC<ConsentBannerProps> = ({ onOpenPreferences }) => {
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>('unset');
  const [isConfigured, setIsConfigured] = useState<boolean>(false);

  useEffect(() => {
    setIsConfigured(analytics.isConfigured());
    setConsentStatus(analytics.getConsent());
  }, []);

  // If analytics is not configured, NEVER show the banner (zero tracker architecture)
  if (!isConfigured || consentStatus !== 'unset') {
    return null;
  }

  const handleAccept = () => {
    analytics.setConsent('granted');
    setConsentStatus('granted');
  };

  const handleDecline = () => {
    analytics.setConsent('denied');
    setConsentStatus('denied');
  };

  return (
    <aside
      className="consent-banner-atelier mono"
      aria-label="Privacy and Analytics Consent Banner"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9990,
        backgroundColor: 'rgba(20, 17, 15, 0.96)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid var(--line-strong)',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.5)',
        animation: 'slideUp 220ms ease-out',
        fontSize: '12px',
        color: 'var(--paper)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', maxWidth: '780px' }}>
        <ShieldCheck size={18} style={{ color: 'var(--moss)', flexShrink: 0 }} />
        <div>
          <span>
            <strong>Optional Telemetry Consent:</strong> CodeMyPicture is configured with anonymous Google Analytics 4. Your photographs and vectors never leave your device. May we collect anonymous conversion and diagnostic metrics to improve the synthesis engine?
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={handleDecline}
          className="v4-btn"
          style={{ padding: '6px 12px', fontSize: '11px' }}
        >
          <X size={12} style={{ marginRight: '4px' }} />
          <span>Decline</span>
        </button>

        <button
          type="button"
          onClick={onOpenPreferences}
          className="v4-btn"
          style={{ padding: '6px 12px', fontSize: '11px' }}
        >
          <Sliders size={12} style={{ marginRight: '4px' }} />
          <span>Customize</span>
        </button>

        <button
          type="button"
          onClick={handleAccept}
          className="v4-btn v4-btn--primary"
          style={{ padding: '6px 14px', fontSize: '11px' }}
        >
          <Check size={12} style={{ marginRight: '4px' }} />
          <span>Accept Analytics</span>
        </button>
      </div>
    </aside>
  );
};

export default ConsentBanner;
