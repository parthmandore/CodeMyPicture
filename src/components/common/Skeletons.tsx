import React from 'react';

/**
 * Reusable base skeleton bar with atelier terminal aesthetics
 */
export const SkeletonBar: React.FC<{
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
  className?: string;
}> = ({ width = '100%', height = '14px', borderRadius = '2px', style, className = '' }) => {
  return (
    <div
      className={`atelier-skeleton-bar ${className}`}
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: 'var(--ink-3, #26211D)',
        backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0) 100%)',
        backgroundSize: '200% 100%',
        animation: 'atelierShimmer 1.8s infinite ease-in-out',
        ...style,
      }}
      aria-hidden="true"
    />
  );
};

/**
 * 1. Image Preview Loading Skeleton
 * Displayed while source photograph is being decoded, loaded, or analyzed
 */
export const PreviewSkeleton: React.FC<{
  width?: number;
  height?: number;
  message?: string;
}> = ({ width = 640, height = 480, message = 'Calibrating image geometry & color channels…' }) => {
  return (
    <div
      className="preview-skeleton-frame"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '380px',
        maxHeight: '620px',
        backgroundColor: 'var(--ink-2, #1C1815)',
        border: '1px solid var(--line, #3A332D)',
        borderRadius: '2px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: '24px',
      }}
      role="status"
      aria-live="polite"
    >
      {/* Corner Crop Marks */}
      <div className="atelier-crop-mark atelier-crop-mark--tl" />
      <div className="atelier-crop-mark atelier-crop-mark--tr" />
      <div className="atelier-crop-mark atelier-crop-mark--bl" />
      <div className="atelier-crop-mark atelier-crop-mark--br" />

      {/* Grid crosshair backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(rgba(255, 79, 46, 0.08) 1px, transparent 0)',
          backgroundSize: '24px 24px',
          opacity: 0.7,
        }}
        aria-hidden="true"
      />

      {/* Center Simulated Aspect Ratio Box */}
      <div
        style={{
          position: 'relative',
          width: '75%',
          maxWidth: `${width}px`,
          height: '65%',
          maxHeight: `${height}px`,
          border: '1px dashed var(--line-strong, #4F453D)',
          borderRadius: '2px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          backgroundColor: 'rgba(20, 17, 15, 0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 2,
        }}
      >
        <div className="analyzing-hud-spinner" aria-hidden="true" />
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', maxWidth: '80%' }}>
          <SkeletonBar width="160px" height="12px" />
          <span className="mono" style={{ fontSize: '11px', color: 'var(--paper-dim)', letterSpacing: '0.04em', textAlign: 'center' }}>
            {message}
          </span>
          <SkeletonBar width="110px" height="10px" />
        </div>
      </div>

      {/* Bottom Status bar */}
      <div
        className="mono"
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '16px',
          right: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: 'var(--paper-muted)',
          zIndex: 2,
        }}
      >
        <span>WASM: RUNNING</span>
        <span>CLIENT MEMORY OK</span>
      </div>
    </div>
  );
};

/**
 * 2. SVG Code Editor Skeleton
 * Displayed while CodeMirror / SVG document is being parsed, cleaned, or initialized
 */
export const EditorSkeleton: React.FC = () => {
  const lineSkeletonWidths = [
    '65%', '45%', '85%', '92%', '30%',
    '78%', '55%', '88%', '40%', '70%',
    '95%', '60%', '50%', '82%', '35%',
    '75%', '48%', '90%', '68%', '42%',
  ];

  return (
    <div
      className="editor-skeleton-wrap"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#090807',
        border: '1px solid var(--line)',
        overflow: 'hidden',
      }}
      role="status"
      aria-label="Loading code editor"
    >
      {/* Editor Header Skeleton */}
      <div
        style={{
          height: '38px',
          backgroundColor: 'var(--ink-2)',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <SkeletonBar width="60px" height="22px" />
          <SkeletonBar width="50px" height="22px" />
          <SkeletonBar width="50px" height="22px" />
          <SkeletonBar width="80px" height="22px" />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <SkeletonBar width="55px" height="22px" />
          <SkeletonBar width="45px" height="22px" />
        </div>
      </div>

      {/* Editor Body with Line Numbers */}
      <div style={{ flex: 1, display: 'flex', padding: '12px 0', overflow: 'hidden' }}>
        {/* Line Numbers Gutter */}
        <div
          className="mono"
          style={{
            width: '42px',
            borderRight: '1px solid var(--line-subtle)',
            paddingRight: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            alignItems: 'flex-end',
            color: 'var(--paper-muted)',
            fontSize: '11px',
            userSelect: 'none',
          }}
        >
          {lineSkeletonWidths.map((_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>

        {/* Code Lines */}
        <div
          style={{
            flex: 1,
            paddingLeft: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            overflow: 'hidden',
          }}
        >
          {lineSkeletonWidths.map((w, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SkeletonBar width={w} height="13px" style={{ opacity: 0.6 + (i % 3) * 0.15 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Status Bar Skeleton */}
      <div
        style={{
          height: '28px',
          backgroundColor: 'var(--ink-2)',
          borderTop: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 14px',
        }}
      >
        <div style={{ display: 'flex', gap: '16px' }}>
          <SkeletonBar width="60px" height="10px" />
          <SkeletonBar width="70px" height="10px" />
          <SkeletonBar width="55px" height="10px" />
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <SkeletonBar width="80px" height="10px" />
          <SkeletonBar width="60px" height="10px" />
        </div>
      </div>
    </div>
  );
};

/**
 * 3. Technical Diagnostics Skeleton
 * Displayed while telemetry and path analysis are calculating
 */
export const DiagnosticsSkeleton: React.FC = () => {
  return (
    <div
      style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        backgroundColor: 'var(--ink)',
        height: '100%',
        overflowY: 'auto',
      }}
      role="status"
      aria-label="Calculating telemetry diagnostics"
    >
      {/* Terminal log box skeleton */}
      <div
        style={{
          backgroundColor: 'var(--ink-2)',
          border: '1px solid var(--line)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '32px',
            borderBottom: '1px solid var(--line)',
            padding: '0 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--ink)',
          }}
        >
          <SkeletonBar width="120px" height="12px" />
          <SkeletonBar width="60px" height="18px" />
        </div>
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <SkeletonBar width="80%" height="11px" />
          <SkeletonBar width="65%" height="11px" />
          <SkeletonBar width="90%" height="11px" />
        </div>
      </div>

      {/* Metrics header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SkeletonBar width="180px" height="14px" />
        <SkeletonBar width="100px" height="24px" />
      </div>

      {/* 8-Card Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '10px',
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              backgroundColor: 'var(--ink-2)',
              border: '1px solid var(--line)',
              borderRadius: '2px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <SkeletonBar width="60%" height="10px" />
            <SkeletonBar width="45%" height="20px" />
            <SkeletonBar width="75%" height="9px" />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 4. Studio Initialization Skeleton
 * Displayed when the Studio Workbench first mounts
 */
export const StudioInitSkeleton: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        backgroundColor: 'var(--ink)',
        overflow: 'hidden',
      }}
      role="status"
      aria-label="Initializing CodeMyPicture Studio Workbench"
    >
      {/* Workbench Header Skeleton */}
      <header
        style={{
          height: '48px',
          borderBottom: '1px solid var(--line)',
          backgroundColor: 'var(--ink-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <SkeletonBar width="130px" height="20px" />
          <SkeletonBar width="180px" height="26px" />
          <SkeletonBar width="150px" height="26px" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <SkeletonBar width="95px" height="30px" />
          <SkeletonBar width="105px" height="30px" />
          <SkeletonBar width="110px" height="30px" />
        </div>
      </header>

      {/* Two Pane Split Skeleton */}
      <main style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left Pane: Code */}
        <section style={{ width: '45%', height: '100%', borderRight: '1px solid var(--line)' }}>
          <EditorSkeleton />
        </section>

        {/* Right Pane: Canvas Viewport */}
        <section style={{ flex: 1, height: '100%', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PreviewSkeleton message="Synthesizing initial vector reconstruction..." />
        </section>
      </main>
    </div>
  );
};
