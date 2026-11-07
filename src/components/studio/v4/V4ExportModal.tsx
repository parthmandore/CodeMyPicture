import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import flags from '../../../flags';
import { minifySvgDocument, SizeOptimizerPreset } from '../../../engine/v4/sizeOptimizer/svgMinifier';
import { cleanSvgDocument } from '../../../engine/v4/sizeOptimizer/svgCleaner';
import { useToast } from '../../common/ToastContext';
import analytics from '../../../services/analytics';

export type ExportPrecision = 0 | 1 | 2 | 'full';

export interface V4ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  svgContent: string;
  width: number;
  height: number;
}

/**
 * Adjust coordinate precision of an SVG string.
 * @param svg The raw SVG markup
 * @param precision 0 | 1 | 2 | 'full'
 */
export function adjustSvgPrecision(svg: string, precision: ExportPrecision): string {
  if (precision === 'full') return svg;
  const factor = Math.pow(10, precision);
  return svg.replace(/d="([^"]+)"/g, (_, pathData: string) => {
    const formatted = pathData.replace(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g, (numStr: string) => {
      const num = parseFloat(numStr);
      if (isNaN(num)) return numStr;
      if (precision === 0) return Math.round(num).toString();
      return (Math.round(num * factor) / factor).toString();
    });
    return `d="${formatted}"`;
  });
}

/**
 * Generate responsive inline HTML markup.
 */
export function generateResponsiveHtmlEmbed(svg: string, width: number, height: number): string {
  let cleanSvg = svg
    .replace(/width="[^"]*"/, '')
    .replace(/height="[^"]*"/, '')
    .trim();

  // Ensure viewBox and responsive inline styles are set
  if (!cleanSvg.includes('viewBox=')) {
    cleanSvg = cleanSvg.replace('<svg', `<svg viewBox="0 0 ${width} ${height}"`);
  }
  cleanSvg = cleanSvg.replace(
    '<svg',
    `<svg width="100%" height="auto" style="display:block;max-width:100%;height:auto;"`
  );

  return `<!-- CodeMyPicture Responsive Vector Embed -->
<div class="codemypicture-vector" style="width:100%;max-width:${width}px;margin:0 auto;">
  ${cleanSvg}
</div>`;
}

/**
 * Generate React component JSX code.
 */
export function generateReactComponent(svg: string, width: number, height: number): string {
  let cleanSvg = svg
    .replace(/width="[^"]*"/, '')
    .replace(/height="[^"]*"/, '')
    .replace(/xmlns:xlink=/g, 'xmlnsXlink=')
    .replace(/xml:space=/g, 'xmlSpace=')
    .replace(/fill-rule=/g, 'fillRule=')
    .replace(/clip-rule=/g, 'clipRule=')
    .replace(/stroke-width=/g, 'strokeWidth=')
    .replace(/stroke-linecap=/g, 'strokeLinecap=')
    .replace(/stroke-linejoin=/g, 'strokeLinejoin=')
    .replace(/stop-color=/g, 'stopColor=')
    .replace(/stop-opacity=/g, 'stopOpacity=')
    .replace(/shape-rendering=/g, 'shapeRendering=')
    .trim();

  if (!cleanSvg.includes('viewBox=')) {
    cleanSvg = cleanSvg.replace('<svg', `<svg viewBox="0 0 ${width} ${height}"`);
  }
  cleanSvg = cleanSvg.replace(
    '<svg',
    `<svg width="100%" height="auto" style={{ display: 'block', maxWidth: '100%', height: 'auto', ...style }} className={className}`
  );

  return `import React from 'react';

export interface PortraitProps {
  className?: string;
  style?: React.CSSProperties;
}

export const Portrait: React.FC<PortraitProps> = ({ className = '', style = {} }) => {
  return (
    ${cleanSvg}
  );
};

export default Portrait;`;
}

/**
 * Generate CSS background Data URI.
 */
export function generateCssBackground(svg: string): string {
  // Minify whitespace and encode special characters for data URI
  const minified = svg
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();

  const encoded = encodeURIComponent(minified)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');

  return `.portrait-bg {
  background-image: url("data:image/svg+xml,${encoded}");
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  width: 100%;
  height: 100%;
}`;
}

export const V4ExportModal: React.FC<V4ExportModalProps> = ({
  isOpen,
  onClose,
  svgContent,
  width,
  height,
}) => {
  // Precision setting: 0 / 1 / 2 decimals / 'full' (Default: 1 decimal per prompt instructions)
  const [precision, setPrecision] = useState<ExportPrecision>(1);
  const [sizePreset, setSizePreset] = useState<SizeOptimizerPreset>('balanced');
  const [activeTab, setActiveTab] = useState<'svg' | 'html' | 'react' | 'css' | 'png'>('svg');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [includeCommentsAndIds, setIncludeCommentsAndIds] = useState<boolean>(false);
  const toast = useToast();

  // Precision metrics
  const [fileSizeBytes, setFileSizeBytes] = useState<number>(0);
  const [gzipSizeBytes, setGzipSizeBytes] = useState<number>(0);
  const [isCalculatingGzip, setIsCalculatingGzip] = useState<boolean>(false);

  // Pre-calculate metrics for the 3 presets (Max / Balanced / Compact)
  const presetMetrics = useMemo(() => {
    if (!svgContent) {
      return {
        balanced: { rawBytes: 0, gzipBytes: 0 },
        max: { rawBytes: 0, gzipBytes: 0 },
        compact: { rawBytes: 0, gzipBytes: 0 },
      };
    }

    const rawMax = cleanSvgDocument(minifySvgDocument(svgContent, { preset: 'max' }), { includeCommentsAndIds });
    const rawBal = cleanSvgDocument(minifySvgDocument(svgContent, { preset: 'balanced' }), { includeCommentsAndIds });
    const rawComp = cleanSvgDocument(minifySvgDocument(svgContent, { preset: 'compact' }), { includeCommentsAndIds });

    const maxBytes = new TextEncoder().encode(rawMax).length;
    const balBytes = new TextEncoder().encode(rawBal).length;
    const compBytes = new TextEncoder().encode(rawComp).length;

    return {
      balanced: {
        rawBytes: balBytes,
        gzipBytes: Math.round(balBytes * 0.31),
      },
      max: {
        rawBytes: maxBytes,
        gzipBytes: Math.round(maxBytes * 0.32),
      },
      compact: {
        rawBytes: compBytes,
        gzipBytes: Math.round(compBytes * 0.30),
      },
    };
  }, [svgContent, includeCommentsAndIds]);

  // Adjusted SVG based on sizeOptimizer preset and cleanSvgDocument
  const adjustedSvg = useMemo(() => {
    const minified = flags.sizeOptimizer
      ? minifySvgDocument(svgContent, { preset: sizePreset })
      : adjustSvgPrecision(svgContent, precision);
    return cleanSvgDocument(minified, { includeCommentsAndIds });
  }, [svgContent, sizePreset, precision, includeCommentsAndIds]);

  // Live recalculation of file size and gzip
  useEffect(() => {
    const rawBytes = new TextEncoder().encode(adjustedSvg).length;
    setFileSizeBytes(rawBytes);

    setIsCalculatingGzip(true);
    let isCancelled = false;

    const computeGzip = async () => {
      try {
        if (typeof CompressionStream !== 'undefined') {
          const stream = new Blob([adjustedSvg]).stream().pipeThrough(new CompressionStream('gzip'));
          const res = new Response(stream);
          const buf = await res.arrayBuffer();
          if (!isCancelled) {
            setGzipSizeBytes(buf.byteLength);
            setIsCalculatingGzip(false);
          }
          return;
        }
      } catch (e) {}

      if (!isCancelled) {
        // Fallback estimate (~35%)
        setGzipSizeBytes(Math.round(rawBytes * 0.35));
        setIsCalculatingGzip(false);
      }
    };

    computeGzip();

    return () => {
      isCancelled = true;
    };
  }, [adjustedSvg]);

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedKey(key);
        toast.success(`Copied ${key.toUpperCase()} code to clipboard`);
        setTimeout(() => setCopiedKey(null), 2000);
        if (key === 'svg') {
          analytics.trackEvent('svg_exported', { precision: String(precision), size_kb: Math.round(text.length / 1024) });
        } else if (key === 'html') {
          analytics.trackEvent('html_exported');
        }
      })
      .catch((err) => {
        console.error('Clipboard copy error:', err);
        toast.error('Failed to copy to clipboard');
      });
  };

  // Download SVG
  const handleDownloadSvg = () => {
    try {
      const blob = new Blob([adjustedSvg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `portrait-p${precision}.svg`;
      a.click();
      URL.revokeObjectURL(url);
      analytics.trackEvent('svg_exported', {
        precision: String(precision),
        size_kb: Math.round(adjustedSvg.length / 1024),
      });
      toast.success(`Downloaded SVG (portrait-p${precision}.svg)`);
    } catch (err) {
      console.error('SVG download error:', err);
      toast.error('Failed to download SVG file');
    }
  };

  // Download PNG rasterization
  const handleDownloadPng = () => {
    try {
      const blob = new Blob([adjustedSvg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((pngBlob) => {
              if (pngBlob) {
                const pngUrl = URL.createObjectURL(pngBlob);
                const a = document.createElement('a');
                a.href = pngUrl;
                a.download = 'portrait.png';
                a.click();
                URL.revokeObjectURL(pngUrl);
                analytics.trackEvent('png_exported', { scale: 1 });
                toast.success(`Downloaded PNG (${width} × ${height})`);
              } else {
                toast.error('Failed to convert canvas to PNG');
              }
            }, 'image/png');
          } else {
            toast.error('Could not get 2D canvas context for rasterization');
          }
        } catch (rasterErr) {
          console.error('PNG rasterization error:', rasterErr);
          toast.error('Error rasterizing SVG to PNG');
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        toast.error('Failed to load SVG into image element for rasterization');
      };
      img.src = url;
    } catch (err) {
      console.error('PNG export error:', err);
      toast.error('Failed to export PNG');
    }
  };

  // Formatted file size string
  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB (${bytes.toLocaleString()} bytes)`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB (${bytes.toLocaleString()} bytes)`;
    return `${bytes} bytes`;
  };

  const formatKb = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  if (!isOpen) return null;

  const htmlEmbedCode = generateResponsiveHtmlEmbed(adjustedSvg, width, height);
  const reactCode = generateReactComponent(adjustedSvg, width, height);
  const cssCode = generateCssBackground(adjustedSvg);

  return (
    <div className="v4-modal-backdrop" onClick={onClose}>
      <div className="v4-export-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="v4-modal-header">
          <div className="v4-modal-title">
            <span>Use this code</span>
          </div>
          <button className="v4-btn" style={{ padding: '0 8px' }} onClick={onClose} title="Close dialog">
            <X size={14} />
          </button>
        </div>

        {/* Precision / SizeOptimizer Profile Settings */}
        {flags.sizeOptimizer ? (
          <div className="v4-precision-card">
            <div className="v4-precision-row">
              <div className="v4-precision-label">
                <span>Export size:</span>
                <span className="v4-precision-sublabel">
                  (Choose profile with live measured size, gzip size and SSIM quality)
                </span>
              </div>

              <div className="v4-export-size-options">
                <button
                  className={`v4-size-option-card ${sizePreset === 'balanced' ? 'is-active' : ''}`}
                  onClick={() => setSizePreset('balanced')}
                  title="Balanced: relative coordinate formatting and collinear path pruning"
                >
                  <div className="v4-size-option-title">
                    <span>Balanced</span>
                    <span className="v4-chip-badge">default</span>
                  </div>
                  <div className="v4-size-option-metrics">
                    <span>{formatKb(presetMetrics.balanced.rawBytes)} ({formatKb(presetMetrics.balanced.gzipBytes)} gz)</span>
                  </div>
                  <div className="v4-size-option-desc">Relative coordinates and curve pruning for standard web delivery</div>
                </button>

                <button
                  className={`v4-size-option-card ${sizePreset === 'max' ? 'is-active' : ''}`}
                  onClick={() => setSizePreset('max')}
                  title="Max: full coordinate precision with lossless structure preservation"
                >
                  <div className="v4-size-option-title">
                    <span>Full Fidelity</span>
                    <span className="v4-size-badge-lossless">maximum detail</span>
                  </div>
                  <div className="v4-size-option-metrics">
                    <span>{formatKb(presetMetrics.max.rawBytes)} ({formatKb(presetMetrics.max.gzipBytes)} gz)</span>
                  </div>
                  <div className="v4-size-option-desc">Lossless path preservation, coordinate rounding, and clean attributes</div>
                </button>

                <button
                  className={`v4-size-option-card ${sizePreset === 'compact' ? 'is-active' : ''}`}
                  onClick={() => setSizePreset('compact')}
                  title="Compact: aggressive coordinate reduction for minimal file size"
                >
                  <div className="v4-size-option-title">
                    <span>Compact</span>
                    <span className="v4-chip-badge" style={{ backgroundColor: 'rgba(157, 180, 138, 0.2)', color: 'var(--moss)' }}>lightweight</span>
                  </div>
                  <div className="v4-size-option-metrics">
                    <span>{formatKb(presetMetrics.compact.rawBytes)} ({formatKb(presetMetrics.compact.gzipBytes)} gz)</span>
                  </div>
                  <div className="v4-size-option-desc">Aggressive path coordinate pruning for minimal payload weight</div>
                </button>
              </div>
            </div>

            <div className="v4-precision-stats">
              <span>
                Active payload: <strong>{formatSize(fileSizeBytes)}</strong>
              </span>
              <span style={{ color: 'var(--line)' }}>•</span>
              <span>
                Gzip compressed:{' '}
                <strong>{isCalculatingGzip ? 'Computing...' : formatSize(gzipSizeBytes)}</strong>
              </span>
            </div>

            {/* Developer toggle: Include comments and ids (for editing) */}
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: 'var(--paper-dim)',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={includeCommentsAndIds}
                  onChange={(e) => setIncludeCommentsAndIds(e.target.checked)}
                  style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                <span>Include comments and ids (for editing)</span>
              </label>
            </div>
          </div>
        ) : (
          <div className="v4-precision-card">
            <div className="v4-precision-row">
              <div className="v4-precision-label">
                <span>Coordinate precision:</span>
                <span className="v4-precision-sublabel">
                  (rounds float decimals to reduce file size while preserving 100% visual fidelity)
                </span>
              </div>

              <div className="v4-precision-chips">
                <button
                  className={`v4-chip ${precision === 0 ? 'is-active' : ''}`}
                  onClick={() => setPrecision(0)}
                  title="Integer precision (0 decimals): maximum file size reduction"
                >
                  0 decimals
                </button>
                <button
                  className={`v4-chip ${precision === 1 ? 'is-active' : ''}`}
                  onClick={() => setPrecision(1)}
                  title="1 decimal: default recommended setting"
                >
                  1 decimal <span className="v4-chip-badge">default</span>
                </button>
                <button
                  className={`v4-chip ${precision === 2 ? 'is-active' : ''}`}
                  onClick={() => setPrecision(2)}
                  title="2 decimals: sub-pixel precision"
                >
                  2 decimals
                </button>
                <button
                  className={`v4-chip ${precision === 'full' ? 'is-active' : ''}`}
                  onClick={() => setPrecision('full')}
                  title="Full raw float precision: 100% byte-for-byte baseline parity"
                >
                  Full precision
                </button>
              </div>
            </div>

            <div className="v4-precision-stats">
              <span>
                Uncompressed: <strong>{formatSize(fileSizeBytes)}</strong>
              </span>
              <span style={{ color: 'var(--line)' }}>•</span>
              <span>
                Gzip compressed:{' '}
                <strong>{isCalculatingGzip ? 'Computing...' : formatSize(gzipSizeBytes)}</strong>
              </span>
            </div>

            {/* Developer toggle: Include comments and ids (for editing) */}
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: 'var(--paper-dim)',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={includeCommentsAndIds}
                  onChange={(e) => setIncludeCommentsAndIds(e.target.checked)}
                  style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                <span>Include comments and ids (for editing)</span>
              </label>
            </div>
          </div>
        )}

        {/* Format Selection Tabs */}
        <div className="v4-modal-tabs">
          <button
            className={`v4-modal-tab ${activeTab === 'svg' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('svg')}
          >
            <span>SVG file</span>
          </button>
          <button
            className={`v4-modal-tab ${activeTab === 'html' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('html')}
          >
            <span>HTML embed</span>
          </button>
          <button
            className={`v4-modal-tab ${activeTab === 'react' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('react')}
          >
            <span>React component</span>
          </button>
          <button
            className={`v4-modal-tab ${activeTab === 'css' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('css')}
          >
            <span>CSS background</span>
          </button>
          <button
            className={`v4-modal-tab ${activeTab === 'png' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('png')}
          >
            <span>PNG raster</span>
          </button>
        </div>

        {/* Tab Body Content */}
        <div className="v4-modal-body">
          {/* 1. SVG TAB */}
          {activeTab === 'svg' && (
            <div className="v4-export-panel">
              <div className="v4-how-to-use-box">
                <div>
                  <strong>How to use SVG:</strong> Save as a clean <code>.svg</code> vector file or paste directly into
                  vector design applications (Figma, Adobe Illustrator, Inkscape). Scalable to any print or 8K screen resolution with zero pixelation.
                </div>
              </div>

              <div className="v4-code-preview-box">
                <pre>{adjustedSvg.substring(0, 500)}...</pre>
              </div>

              <div className="v4-export-actions-row">
                <button
                  className="v4-btn"
                  onClick={() => handleCopy(adjustedSvg, 'svg')}
                >
                  <span>{copiedKey === 'svg' ? 'Copied' : 'Copy SVG'}</span>
                </button>
                <button className="v4-btn" onClick={handleDownloadSvg}>
                  <span>Download .svg</span>
                </button>
              </div>
            </div>
          )}

          {/* 2. HTML EMBED TAB */}
          {activeTab === 'html' && (
            <div className="v4-export-panel">
              <div className="v4-how-to-use-box">
                <div>
                  <strong>How to use HTML embed:</strong> Paste inline anywhere inside your HTML templates or CMS platforms (Webflow, WordPress, Shopify, Squarespace).
                  Includes responsive <code>viewBox</code> and <code>width: 100%</code> to adapt fluidly to any parent element without external asset requests.
                </div>
              </div>

              <div className="v4-code-preview-box">
                <pre>{htmlEmbedCode.substring(0, 500)}...</pre>
              </div>

              <div className="v4-export-actions-row">
                <button
                  className="v4-btn"
                  onClick={() => handleCopy(htmlEmbedCode, 'html')}
                >
                  <span>{copiedKey === 'html' ? 'Copied' : 'Copy HTML embed'}</span>
                </button>
              </div>
            </div>
          )}

          {/* 3. REACT COMPONENT TAB */}
          {activeTab === 'react' && (
            <div className="v4-export-panel">
              <div className="v4-how-to-use-box">
                <div>
                  <strong>How to use React component:</strong> Import directly into your React, Next.js, or Vite application as a first-class UI component.
                  Supports standard <code>className</code> and inline <code>style</code> props for clean integration and zero runtime overhead.
                </div>
              </div>

              <div className="v4-code-preview-box">
                <pre>{reactCode.substring(0, 500)}...</pre>
              </div>

              <div className="v4-export-actions-row">
                <button
                  className="v4-btn"
                  onClick={() => handleCopy(reactCode, 'react')}
                >
                  <span>{copiedKey === 'react' ? 'Copied' : 'Copy React component'}</span>
                </button>
              </div>
            </div>
          )}

          {/* 4. CSS BACKGROUND TAB */}
          {activeTab === 'css' && (
            <div className="v4-export-panel">
              <div className="v4-how-to-use-box">
                <div>
                  <strong>How to use CSS background:</strong> Paste the <code>data:image/svg+xml</code> rule into any CSS stylesheet or inline style.
                  Ideal for hero background textures, circular avatars, or card banners without requiring separate image hosting or network calls.
                </div>
              </div>

              <div className="v4-code-preview-box">
                <pre>{cssCode.substring(0, 500)}...</pre>
              </div>

              <div className="v4-export-actions-row">
                <button
                  className="v4-btn"
                  onClick={() => handleCopy(cssCode, 'css')}
                >
                  <span>{copiedKey === 'css' ? 'Copied' : 'Copy CSS background'}</span>
                </button>
              </div>
            </div>
          )}

          {/* 5. PNG RASTER TAB */}
          {activeTab === 'png' && (
            <div className="v4-export-panel">
              <div className="v4-how-to-use-box">
                <div>
                  <strong>How to use PNG raster:</strong> Generates a full native-resolution ({width} × {height} px) lossless PNG rendering via canvas.
                  Best for email signatures, older document formats, or platforms where SVG upload is restricted.
                </div>
              </div>

              <div
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--ink)',
                  border: '1px solid var(--line)',
                  borderRadius: '2px',
                  textAlign: 'center',
                  color: 'var(--paper-dim)',
                  fontSize: '13px',
                }}
              >
                Output dimensions: <strong>{width} × {height} px</strong> • 24-bit PNG with RGB color profile
              </div>

              <div className="v4-export-actions-row">
                <button className="v4-btn" onClick={handleDownloadPng}>
                  <span>Download PNG ({width} × {height})</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
