import React from 'react';
import { Upload, Sparkles, Terminal, AlertCircle, Image as ImageIcon, Layers } from 'lucide-react';

/**
 * 1. No Image Uploaded Empty State
 */
export const EmptyPhotoState: React.FC<{
  onUploadClick: () => void;
  isDragging?: boolean;
}> = ({ onUploadClick, isDragging = false }) => {
  return (
    <div
      className={`atelier-frame atelier-frame--empty ${isDragging ? 'is-drag-over' : ''}`}
      onClick={onUploadClick}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '360px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: '32px 24px',
        textAlign: 'center',
        backgroundColor: 'var(--ink-2)',
        border: '1px dashed var(--line-strong)',
        borderRadius: '2px',
        position: 'relative',
      }}
      role="region"
      aria-label="No photograph loaded"
    >
      <div className="atelier-crop-mark atelier-crop-mark--tl" />
      <div className="atelier-crop-mark atelier-crop-mark--tr" />
      <div className="atelier-crop-mark atelier-crop-mark--bl" />
      <div className="atelier-crop-mark atelier-crop-mark--br" />

      <div
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '4px',
          backgroundColor: 'var(--ink-3)',
          border: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--vermilion)',
          marginBottom: '16px',
        }}
        aria-hidden="true"
      >
        <ImageIcon size={24} />
      </div>

      <div className="mono" style={{ fontSize: '11px', color: 'var(--vermilion)', letterSpacing: '0.08em', fontWeight: 600, marginBottom: '6px' }}>
        01 // NO SOURCE PHOTOGRAPH LOADED
      </div>

      <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--paper)', marginBottom: '8px' }}>
        Select or Drag & Drop a Photograph
      </h3>

      <p style={{ fontSize: '13px', color: 'var(--paper-dim)', maxWidth: '440px', lineHeight: 1.5, marginBottom: '20px' }}>
        Load a portrait or scene photograph to begin local-first vector reconstruction. Zero cloud uploads — 100% processed in your browser memory.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          type="button"
          className="v4-btn v4-btn--accent"
          onClick={(e) => {
            e.stopPropagation();
            onUploadClick();
          }}
          style={{ height: '34px', padding: '0 16px', fontSize: '13px' }}
        >
          <Upload size={14} style={{ marginRight: '6px' }} />
          <span>Upload Photograph</span>
        </button>

        <span
          className="mono"
          style={{
            fontSize: '11px',
            color: 'var(--paper-muted)',
            padding: '4px 10px',
            border: '1px solid var(--line)',
            borderRadius: '2px',
            backgroundColor: 'var(--ink)',
          }}
        >
          JPEG · PNG · WebP (up to 25 MB)
        </span>
      </div>
    </div>
  );
};

/**
 * 2. No SVG Generated Empty State
 * Displayed in Code Editor or Result pane before synthesis runs
 */
export const EmptySvgState: React.FC<{
  onGenerate: () => void;
  isGenerating?: boolean;
  context?: 'editor' | 'result';
}> = ({ onGenerate, isGenerating = false, context = 'editor' }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '36px 24px',
        textAlign: 'center',
        height: '100%',
        minHeight: '280px',
        backgroundColor: context === 'editor' ? '#090807' : 'transparent',
      }}
      role="region"
      aria-label="Vector code not yet generated"
    >
      <div
        style={{
          width: '46px',
          height: '46px',
          borderRadius: '4px',
          backgroundColor: 'var(--ink-2)',
          border: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent)',
          marginBottom: '14px',
        }}
        aria-hidden="true"
      >
        <Sparkles size={22} />
      </div>

      <div className="mono" style={{ fontSize: '11px', color: 'var(--accent)', letterSpacing: '0.06em', fontWeight: 600, marginBottom: '6px' }}>
        02 // AWAITING SYNTHESIS
      </div>

      <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--paper)', marginBottom: '8px' }}>
        Vector Code Not Yet Generated
      </h3>

      <p style={{ fontSize: '13px', color: 'var(--paper-dim)', maxWidth: '400px', lineHeight: 1.5, marginBottom: '20px' }}>
        Source photo is calibrated. Select your synthesis mode (Exact copy or Painting) and fidelity above, then generate your clean SVG code.
      </p>

      <button
        type="button"
        className="v4-btn v4-btn--accent"
        onClick={onGenerate}
        disabled={isGenerating}
        style={{ height: '34px', padding: '0 18px', fontSize: '13px' }}
      >
        <Layers size={14} style={{ marginRight: '6px' }} />
        <span>{isGenerating ? 'Synthesizing…' : 'Generate Vector Artwork'}</span>
      </button>
    </div>
  );
};

/**
 * 3. No Diagnostics Available Empty State
 */
export const EmptyDiagnosticsState: React.FC<{
  onGenerate: () => void;
}> = ({ onGenerate }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        textAlign: 'center',
        height: '100%',
        backgroundColor: 'var(--ink)',
      }}
      role="region"
      aria-label="No diagnostics available"
    >
      <div
        style={{
          width: '46px',
          height: '46px',
          borderRadius: '4px',
          backgroundColor: 'var(--ink-2)',
          border: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--paper-dim)',
          marginBottom: '14px',
        }}
        aria-hidden="true"
      >
        <Terminal size={22} />
      </div>

      <div className="mono" style={{ fontSize: '11px', color: 'var(--paper-dim)', letterSpacing: '0.06em', fontWeight: 600, marginBottom: '6px' }}>
        DIAGNOSTICS // STANDBY
      </div>

      <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--paper)', marginBottom: '8px' }}>
        Telemetry Offline
      </h3>

      <p style={{ fontSize: '13px', color: 'var(--paper-dim)', maxWidth: '420px', lineHeight: 1.5, marginBottom: '20px' }}>
        Vector DOM statistics, Bézier path counts, color quantization clusters, and gzip compression metrics will be computed in real-time once vector code is generated.
      </p>

      <button
        type="button"
        className="v4-btn v4-btn--accent"
        onClick={onGenerate}
        style={{ height: '34px', padding: '0 18px', fontSize: '13px' }}
      >
        <span>Generate Vector Artwork</span>
      </button>
    </div>
  );
};

/**
 * 4. Missing / Unavailable Content State
 */
export const MissingContentState: React.FC<{
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, message, actionLabel, onAction }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '36px 20px',
        textAlign: 'center',
        height: '100%',
        minHeight: '240px',
      }}
      role="region"
      aria-label={title}
    >
      <div
        style={{
          width: '42px',
          height: '42px',
          borderRadius: '4px',
          backgroundColor: 'var(--ink-2)',
          border: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--paper-dim)',
          marginBottom: '12px',
        }}
        aria-hidden="true"
      >
        <AlertCircle size={20} />
      </div>

      <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--paper)', marginBottom: '6px' }}>
        {title}
      </h4>

      <p style={{ fontSize: '13px', color: 'var(--paper-dim)', maxWidth: '380px', lineHeight: 1.5, marginBottom: actionLabel ? '16px' : 0 }}>
        {message}
      </p>

      {actionLabel && onAction && (
        <button
          type="button"
          className="v4-btn"
          onClick={onAction}
          style={{ height: '32px', padding: '0 14px', fontSize: '12px' }}
        >
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
};
