import React, { useRef, useEffect } from 'react';
import { TechnicalDiagnostics } from '../../../utils/svgDiagnostics';
import { CheckCircle2, Cpu, Palette, Sparkles, Terminal } from 'lucide-react';
import { DiagnosticsSkeleton } from '../../common/Skeletons';
import { EmptyDiagnosticsState } from '../../common/EmptyStates';

export interface TerminalLogItem {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warn' | 'error' | 'summary';
}

export interface TechnicalDiagnosticsPanelProps {
  diagnostics: TechnicalDiagnostics;
  onCopyTelemetry?: () => void;
  className?: string;
  logs?: TerminalLogItem[];
  onClearLogs?: () => void;
  isGenerating?: boolean;
  progressPercent?: number;
  generationStage?: string;
  onCancel?: () => void;
  onGenerate?: () => void;
  mode?: 'painting' | 'recreation';
}

export const TechnicalDiagnosticsPanel: React.FC<TechnicalDiagnosticsPanelProps> = ({
  diagnostics,
  onCopyTelemetry,
  className = '',
  logs = [],
  onClearLogs,
  isGenerating = false,
  progressPercent,
  generationStage,
  onCancel,
  onGenerate,
  mode = 'painting',
}) => {
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll logs to bottom as they arrive
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isGenerating]);

  const formatBytes = (bytes: number | null | undefined): string => {
    if (bytes === null || bytes === undefined || bytes <= 0) return '—';
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes.toLocaleString()} B`;
  };

  const formatDuration = (ms: number | null | undefined): string => {
    if (ms === null || ms === undefined || ms <= 0) return '—';
    if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
    return `${Math.round(ms)} ms`;
  };

  if (!isGenerating && diagnostics.pathCount === 0 && (!logs || logs.length === 0)) {
    return <EmptyDiagnosticsState onGenerate={onGenerate || (() => {})} />;
  }

  if (isGenerating && diagnostics.pathCount === 0 && (!logs || logs.length === 0)) {
    return <DiagnosticsSkeleton />;
  }

  return (
    <div className={`technical-diagnostics-dashboard ${className}`} role="region" aria-label="Technical Diagnostics">
      {/* 0. Live Execution Terminal & Pipeline Logs */}
      <div className="diag-terminal-box" style={{ marginBottom: '16px', border: '1px solid var(--line)', borderRadius: '2px', overflow: 'hidden' }}>
        <div
          className="diag-terminal-box__header mono"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            backgroundColor: 'var(--ink, #14110F)',
            borderBottom: '1px solid var(--line)',
            fontSize: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>›</span>
            <span style={{ color: 'var(--paper)', fontWeight: 600 }}>{mode === 'recreation' ? 'recreation.log' : 'studio.log'}</span>
            {isGenerating ? (
              <span style={{ color: 'var(--amber, #f59e0b)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Cpu size={12} />
                <span>{generationStage || 'Processing…'}</span>
              </span>
            ) : (
              <span style={{ color: 'var(--moss, #9db48a)', fontSize: '11px' }}>
                ✓ Complete
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isGenerating && onCancel && (
              <button
                type="button"
                className="v4-btn v4-btn--danger"
                style={{ height: '22px', padding: '0 8px', fontSize: '11px' }}
                onClick={onCancel}
              >
                Cancel
              </button>
            )}
            {onClearLogs && (
              <button
                type="button"
                className="v4-btn"
                style={{ height: '22px', padding: '0 8px', fontSize: '11px' }}
                onClick={onClearLogs}
              >
                Clear
              </button>
            )}
            <button
              type="button"
              className="v4-btn"
              style={{ height: '22px', padding: '0 8px', fontSize: '11px' }}
              onClick={() => {
                const text = (logs || []).map((l) => `[${l.timestamp}] ${l.message}`).join('\n');
                navigator.clipboard.writeText(text);
              }}
            >
              Copy Logs
            </button>
          </div>
        </div>

        {isGenerating && progressPercent !== undefined && progressPercent > 0 && (
          <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)', width: '100%', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.max(3, progressPercent))}%`,
                background: 'var(--accent)',
                transition: 'width 0.2s ease',
              }}
            />
          </div>
        )}

        <div
          ref={logContainerRef}
          className="diag-terminal-box__body mono"
          style={{
            maxHeight: '220px',
            overflowY: 'auto',
            padding: '10px 12px',
            backgroundColor: '#090807',
            fontSize: '11.5px',
            lineHeight: '1.6',
            color: '#c5bfb4',
          }}
        >
          {(!logs || logs.length === 0) ? (
            <div style={{ color: 'var(--paper-dim)' }}>Awaiting pipeline execution… Photo uploaded and calibrated.</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} style={{ display: 'flex', gap: '8px' }}>
                <span style={{ color: 'var(--paper-dim)', flexShrink: 0 }}>[{log.timestamp}]</span>
                <span
                  style={{
                    color:
                      log.type === 'error'
                        ? 'var(--vermilion, #ef4444)'
                        : log.type === 'warn'
                        ? 'var(--amber, #f59e0b)'
                        : log.type === 'success'
                        ? 'var(--moss, #10b981)'
                        : log.type === 'summary'
                        ? 'var(--accent, #3b82f6)'
                        : '#ece5d6',
                  }}
                >
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 1. Header Bar with Status Pill & Copy Telemetry */}
      <div className="diag-header-row mono">
        <div className="diag-title-group">
          <Terminal size={14} className="diag-title-icon" />
          <span className="diag-title-text">SYSTEM DIAGNOSTICS & TELEMETRY</span>
          <span className={`diag-status-badge diag-status-badge--${diagnostics.status}`}>
            {diagnostics.status === 'success' && <CheckCircle2 size={11} />}
            {diagnostics.status === 'generating' && <Cpu size={11} />}
            <span>STATUS: {diagnostics.status.toUpperCase()}</span>
          </span>
        </div>

        {onCopyTelemetry && (
          <button
            type="button"
            className="v4-btn diag-copy-btn"
            onClick={onCopyTelemetry}
            title="Copy technical metrics in JSON format"
          >
            <span>Copy Telemetry JSON</span>
          </button>
        )}
      </div>

      {/* 2. Primary Metrics Grid (11 Required Values) */}
      <div className="diag-metrics-grid">
        {/* Metric 1: Source Image Dimensions */}
        <div className="diag-card">
          <div className="diag-card__label" title="Source photograph pixel dimensions and computed aspect ratio">
            <span>01 // SOURCE IMAGE</span>
          </div>
          <div className="diag-card__value mono">
            {diagnostics.imageWidth && diagnostics.imageHeight ? (
              <>
                <span>{diagnostics.imageWidth} × {diagnostics.imageHeight}</span>
                <span className="diag-card__unit">px</span>
              </>
            ) : (
              <span className="diag-card__empty">—</span>
            )}
          </div>
          <div className="diag-card__subtext mono">
            {diagnostics.aspectRatio ? `Aspect Ratio ${diagnostics.aspectRatio}` : 'No image loaded'}
          </div>
        </div>

        {/* Metric 2: Generated SVG Paths */}
        <div className="diag-card">
          <div className="diag-card__label" title="Exact count of <path> elements in synthesized vector document">
            <span>02 // SVG PATHS</span>
          </div>
          <div className="diag-card__value mono">
            <span>{diagnostics.pathCount.toLocaleString()}</span>
            <span className="diag-card__unit">paths</span>
          </div>
          <div className="diag-card__subtext mono">
            Continuous Bézier curves
          </div>
        </div>

        {/* Metric 3: Total SVG Shapes & Elements */}
        <div className="diag-card">
          <div className="diag-card__label" title="Total geometric primitives (paths, background rects, circles, polygons)">
            <span>03 // SHAPES & ELEMENTS</span>
          </div>
          <div className="diag-card__value mono">
            <span>{diagnostics.shapeCount.toLocaleString()}</span>
            <span className="diag-card__unit">shapes</span>
          </div>
          <div className="diag-card__subtext mono">
            {diagnostics.totalElementCount > 0 ? `${diagnostics.totalElementCount} DOM elements total` : 'Awaiting synthesis'}
          </div>
        </div>

        {/* Metric 4: Distinct Fill Colors in SVG */}
        <div className="diag-card">
          <div className="diag-card__label" title="Count of distinct fill colors in SVG code. Not identical to source image colors.">
            <span>04 // GENERATED FILL COLORS</span>
          </div>
          <div className="diag-card__value mono">
            <span>{diagnostics.distinctFillColors}</span>
            <span className="diag-card__unit">colors</span>
          </div>
          <div className="diag-card__subtext mono">
            Document color palette
          </div>
        </div>

        {/* Metric 5: Source Colors Sampled */}
        <div className="diag-card">
          <div className="diag-card__label" title="Genuinely sampled biometric and scene color anchors from the photograph">
            <span>05 // SAMPLED FROM SOURCE</span>
          </div>
          <div className="diag-card__value mono">
            {diagnostics.sourceColorsSampled !== null ? (
              <>
                <span>{diagnostics.sourceColorsSampled}</span>
                <span className="diag-card__unit">samples</span>
              </>
            ) : (
              <span className="diag-card__empty">—</span>
            )}
          </div>
          <div className="diag-card__subtext mono">
            {diagnostics.sourceColorsSampled !== null ? 'Skin, hair, lips, ambient bg' : 'Unavailable (not sampled)'}
          </div>
        </div>

        {/* Metric 6: Raw SVG File Size */}
        <div className="diag-card">
          <div className="diag-card__label" title="Uncompressed UTF-8 SVG string payload size">
            <span>06 // RAW SVG PAYLOAD</span>
          </div>
          <div className="diag-card__value mono">
            <span>{formatBytes(diagnostics.rawSizeBytes)}</span>
          </div>
          <div className="diag-card__subtext mono">
            {diagnostics.rawSizeBytes > 0 ? `${diagnostics.rawSizeBytes.toLocaleString()} bytes text` : 'Awaiting document'}
          </div>
        </div>

        {/* Metric 7: Gzipped SVG Size */}
        <div className="diag-card">
          <div className="diag-card__label" title="Genuinely calculated compressed transfer size via native CompressionStream">
            <span>07 // GZIP TRANSFER SIZE</span>
          </div>
          <div className="diag-card__value mono">
            {diagnostics.gzipSizeBytes !== null ? (
              <span>{formatBytes(diagnostics.gzipSizeBytes)}</span>
            ) : (
              <span className="diag-card__empty">—</span>
            )}
          </div>
          <div className="diag-card__subtext mono">
            {diagnostics.compressionRatioPct !== null
              ? `${diagnostics.compressionRatioPct}% transfer reduction`
              : 'Calculating stream…'}
          </div>
        </div>

        {/* Metric 8: Processing Duration */}
        <div className="diag-card">
          <div className="diag-card__label" title="Measured end-to-end vector pipeline duration">
            <span>08 // SYNTHESIS DURATION</span>
          </div>
          <div className="diag-card__value mono">
            <span>{formatDuration(diagnostics.durationMs)}</span>
          </div>
          <div className="diag-card__subtext mono">
            {diagnostics.durationMs ? 'Client-side WebWorker' : 'Ready'}
          </div>
        </div>

        {/* Metric 9 & 10: Selected Mode & Quality */}
        <div className="diag-card">
          <div className="diag-card__label" title="Active synthesis configuration">
            <span>09 // CONFIGURATION</span>
          </div>
          <div className="diag-card__value mono" style={{ fontSize: '14px', textTransform: 'uppercase' }}>
            <span style={{ color: 'var(--moss)' }}>{diagnostics.mode}</span>
            <span style={{ color: 'var(--paper-dim)', margin: '0 4px' }}>/</span>
            <span style={{ color: 'var(--paper)' }}>{diagnostics.quality}</span>
          </div>
          <div className="diag-card__subtext mono">
            {diagnostics.mode === 'recreation' ? 'Photographic vector contouring' : 'Organic vector plane massing'}
          </div>
        </div>
      </div>

      {/* 3. Generated SVG Color Swatches Strip */}
      {diagnostics.distinctPaletteSamples && diagnostics.distinctPaletteSamples.length > 0 && (
        <div className="diag-palette-strip mono">
          <div className="diag-palette-strip__header">
            <Palette size={12} />
            <span>GENERATED SVG PALETTE SAMPLES ({diagnostics.distinctFillColors} TOTAL COLORS)</span>
          </div>
          <div className="diag-palette-strip__chips">
            {diagnostics.distinctPaletteSamples.map((hex, idx) => (
              <div key={`${hex}-${idx}`} className="diag-palette-chip" title={`Color: ${hex}`}>
                <span className="diag-palette-chip__color" style={{ backgroundColor: hex }} />
                <span className="diag-palette-chip__hex">{hex}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Genuinely Sampled Source Biometrics (if available) */}
      {diagnostics.sourceColorSamples && diagnostics.sourceColorSamples.length > 0 && (
        <div className="diag-palette-strip mono">
          <div className="diag-palette-strip__header">
            <Sparkles size={12} style={{ color: 'var(--accent)' }} />
            <span>BIOMETRIC SAMPLING PROVENANCE ({diagnostics.sourceColorSamples.length} REGIONS)</span>
          </div>
          <div className="diag-palette-strip__chips">
            {diagnostics.sourceColorSamples.map((sample) => (
              <div key={sample.label} className="diag-palette-chip" title={`${sample.label}: ${sample.hex}`}>
                <span className="diag-palette-chip__color" style={{ backgroundColor: sample.hex }} />
                <span className="diag-palette-chip__hex">{sample.label} ({sample.hex})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TechnicalDiagnosticsPanel;
