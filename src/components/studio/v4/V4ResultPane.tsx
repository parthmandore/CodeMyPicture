import "../../../styles/reconstructionAnimation.css";
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SplitSquareVertical } from 'lucide-react';
import { WorkbenchStatus } from '../../../engine/v4/types';
import {
  GeometryOverlay,
  GeometryOverlayMode,
} from './GeometryOverlay';
import {
  extractFullImageGeometry,
  FullImageGeometryData,
} from '../../../services/geometry/imageGeometryService';
import { SvgSizeStats } from '../../../utils/svgDiagnostics';
import { ThinkingOrb } from './ThinkingOrb';
import { EmptyPhotoState, EmptySvgState, MissingContentState } from '../../common/EmptyStates';

export type ResultViewMode = 'result' | 'photo' | 'side-by-side' | 'wipe-slider' | 'diff';

export interface V4ResultPaneProps {
  mode?: 'recreation' | 'painting';
  quality?: 'high' | 'medium' | 'low';
  currentImgUrl: string;
  fileName?: string;
  svgBlobUrl: string;
  lastGoodBlobUrl: string;
  diffBlobUrl?: string | null;
  status?: WorkbenchStatus;
  isGenerating: boolean;
  generationStage?: string;
  progressPercent?: number;
  width: number;
  height: number;
  sizeStats?: SvgSizeStats | null;
  isDraggingFile?: boolean;
  onDropAreaClick?: () => void;
  onGenerate?: () => void;
  accentColor?: string;
  layers?: any[];
  landmarks?: any[];
}

export const V4ResultPane: React.FC<V4ResultPaneProps> = ({
  mode = 'painting',
  quality = 'high',
  currentImgUrl,
  fileName: _fileName = 'photo.jpg',
  svgBlobUrl,
  lastGoodBlobUrl,
  diffBlobUrl,
  status: _status,
  isGenerating = false,
  generationStage = '',
  progressPercent: _progressPercent = 0,
  width,
  height,
  sizeStats,
  isDraggingFile = false,
  onDropAreaClick,
  onGenerate,
  accentColor = '#FF4F2E',
  layers = [],
  landmarks = [],
}) => {
  const [viewMode, setViewMode] = useState<ResultViewMode>('side-by-side');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const [overlayMode] = useState<GeometryOverlayMode>('none');
  const [geometryData, setGeometryData] = useState<FullImageGeometryData | null>(null);

  // Clean background generation tracking without 100ms timer churn

  // Extract geometry for overlays
  useEffect(() => {
    if (!currentImgUrl) {
      setGeometryData(null);
      return;
    }
    let isCancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (isCancelled) return;
      try {
        const geo = extractFullImageGeometry(
          img,
          width || img.naturalWidth || 800,
          height || img.naturalHeight || 800,
          landmarks || []
        );
        setGeometryData(geo);
      } catch (e) {
        console.warn('Failed to extract full image geometry:', e);
      }
    };
    img.src = currentImgUrl;
    return () => {
      isCancelled = true;
    };
  }, [currentImgUrl, width, height, landmarks]);

  const startPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const startOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const sliderWrapRef = useRef<HTMLDivElement | null>(null);
  const isDraggingSliderRef = useRef<boolean>(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const effectiveSvgUrl = svgBlobUrl || lastGoodBlobUrl;

  // Always show side by side view when result is generated
  const prevSvgUrlRef = useRef<string>('');
  useEffect(() => {
    if (effectiveSvgUrl && !isGenerating && prevSvgUrlRef.current !== effectiveSvgUrl) {
      setViewMode('side-by-side');
      prevSvgUrlRef.current = effectiveSvgUrl;
    }
  }, [effectiveSvgUrl, isGenerating]);

  const handleZoomIn = () => setZoomLevel((z) => Math.min(500, z + 25));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(25, z - 25));
  const handleResetFit = () => {
    setZoomLevel(100);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 15 : -15;
    setZoomLevel((z) => Math.max(25, Math.min(500, z + delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (viewMode === 'wipe-slider' && sliderWrapRef.current) {
      isDraggingSliderRef.current = true;
      return;
    }

    if (zoomLevel > 100 || e.button === 1 || e.shiftKey) {
      setIsPanning(true);
      startPanRef.current = { x: e.clientX, y: e.clientY };
      startOffsetRef.current = { ...panOffset };
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isPanning) {
        const dx = e.clientX - startPanRef.current.x;
        const dy = e.clientY - startPanRef.current.y;
        setPanOffset({
          x: startOffsetRef.current.x + dx,
          y: startOffsetRef.current.y + dy,
        });
      }
      if (isDraggingSliderRef.current && sliderWrapRef.current) {
        const rect = sliderWrapRef.current.getBoundingClientRect();
        const pos = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        setSliderPos(pos);
      }
    };

    const handleMouseUp = () => {
      setIsPanning(false);
      isDraggingSliderRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanning]);

  // Focus mode toggle on 'F' key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('.cm-editor'))
      ) {
        return;
      }

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setIsFocusMode((prev) => !prev);
      } else if (e.key === 'Escape') {
        if (isFocusMode) {
          e.preventDefault();
          setIsFocusMode(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocusMode]);

  // Keyboard navigation for view mode segmented control
  const viewModesList: ResultViewMode[] = ['result', 'photo', 'side-by-side', 'wipe-slider', 'diff'];
  const handleViewKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const idx = viewModesList.indexOf(viewMode);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = viewModesList[(idx + 1) % viewModesList.length];
        setViewMode(next);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = viewModesList[(idx - 1 + viewModesList.length) % viewModesList.length];
        setViewMode(prev);
      }
    },
    [viewMode, viewModesList]
  );

  const isEmpty = !currentImgUrl;

  // Single source caption under picture: e.g. "Painting · High · 77 paths · 1.1 MB gz · 1200x1600"
  const modeTitle = mode === 'recreation' ? 'Exact copy' : 'Painting';
  const qualityTitle = quality === 'high' ? 'High' : quality === 'medium' ? 'Medium' : 'Low';
  const pathsText = sizeStats ? `${sizeStats.pathCount.toLocaleString()} paths` : '0 paths';
  const gzText = sizeStats && sizeStats.formattedGzip ? `${sizeStats.formattedGzip} gz` : '0 KB gz';
  const dimsText = width > 0 && height > 0 ? `${width}x${height}` : '';
  const captionText = isGenerating && !effectiveSvgUrl
    ? `${modeTitle} · ${qualityTitle} · Generating vector artwork…`
    : `${modeTitle} · ${qualityTitle} · ${pathsText} · ${gzText}${dimsText ? ` · ${dimsText}` : ''}`;

  return (
    <div className={`v4-result-section ${isFocusMode ? 'is-focus-mode' : ''}`}>
      {/* 1. Atelier Result Header: Segmented view switcher left, Inspect v popover right */}
      <div className="v4-result-header">
        <div
          className="v4-segmented-group"
          role="tablist"
          aria-label="Result View Mode"
          onKeyDown={handleViewKeyDown}
        >
          <button
            className={`v4-segmented-item ${viewMode === 'result' ? 'is-active' : ''}`}
            onClick={() => setViewMode('result')}
            title="Result vector output"
            tabIndex={0}
          >
            <span>Result</span>
          </button>
          <button
            className={`v4-segmented-item ${viewMode === 'photo' ? 'is-active' : ''}`}
            onClick={() => setViewMode('photo')}
            title="Original source photograph"
            tabIndex={0}
          >
            <span>Original</span>
          </button>
          <button
            className={`v4-segmented-item ${viewMode === 'side-by-side' ? 'is-active' : ''}`}
            onClick={() => setViewMode('side-by-side')}
            title="Side-by-side visual comparison"
            tabIndex={0}
          >
            <span>Side by side</span>
          </button>
          <button
            className={`v4-segmented-item ${viewMode === 'wipe-slider' ? 'is-active' : ''}`}
            onClick={() => setViewMode('wipe-slider')}
            title="Interactive before/after wipe slider"
            tabIndex={0}
          >
            <span>Wipe</span>
          </button>
          <button
            className={`v4-segmented-item ${viewMode === 'diff' ? 'is-active' : ''}`}
            onClick={() => setViewMode('diff')}
            title="Difference error map"
            tabIndex={0}
          >
            <span>Diff</span>
          </button>
        </div>


      </div>

      {/* 2. Paper-Grain Viewport Canvas Area */}
      <div
        className="v4-viewport-canvas"
        ref={viewportRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        style={{
          cursor:
            isPanning
              ? 'grabbing'
              : zoomLevel > 100
              ? 'grab'
              : viewMode === 'wipe-slider'
              ? 'ew-resize'
              : 'default',
        }}
      >
        {/* Floating Zoom Bar inside result area (Bottom-Right) */}
        {!isEmpty && !isGenerating && (
          <div className="v4-floating-zoom-bar" role="toolbar" aria-label="Zoom controls">
            <button className="v4-btn v4-btn--icon" onClick={handleZoomOut} title="Zoom out">
              -
            </button>
            <span className="v4-zoom-level mono">{zoomLevel}%</span>
            <button className="v4-btn v4-btn--icon" onClick={handleZoomIn} title="Zoom in">
              +
            </button>
            <button className="v4-btn v4-btn--sm" onClick={handleResetFit} title="Reset zoom to 100%">
              Fit
            </button>
            <button
              className={`v4-btn v4-btn--sm ${isFocusMode ? 'v4-btn--accent' : ''}`}
              onClick={() => setIsFocusMode(!isFocusMode)}
              title="Toggle focus mode (F)"
            >
              Focus
            </button>
          </div>
        )}

        {isEmpty ? (
          /* State B: Empty State (Dashed drop zone) */
          <EmptyPhotoState onUploadClick={onDropAreaClick || (() => {})} isDragging={isDraggingFile} />
        ) : (
          /* Populated Viewport with L-shaped crop marks */
          <div className={`atelier-frame ${isDraggingFile ? 'is-drag-over' : ''}`}>
            <div className="atelier-crop-mark atelier-crop-mark--tl" />
            <div className="atelier-crop-mark atelier-crop-mark--tr" />
            <div className="atelier-crop-mark atelier-crop-mark--bl" />
            <div className="atelier-crop-mark atelier-crop-mark--br" />

            {/* Picture Content: Zoom and Pan apply strictly to inner container */}
            <div className="atelier-frame-content">
              <div
                className="atelier-zoom-container"
                style={{
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel / 100})`,
                  transformOrigin: 'center center',
                  transition: isPanning ? 'none' : 'transform 0.1s ease-out',
                }}
              >
                {/* 1. Result View (SVG if ready and not regenerating, loading state with photo & signature animation otherwise) */}
                {viewMode === 'result' && (
                  <div className="v4-preview-wrapper" style={{ position: 'relative' }}>
                    {!isGenerating && effectiveSvgUrl ? (
                      <img
                        src={effectiveSvgUrl}
                        alt="Vector reconstruction result"
                        className="v4-preview-img"
                        width={width || 800}
                        height={height || 600}
                        decoding="async"
                        draggable={false}
                      />
                    ) : (
                      <div className="anim-viewport-stage" style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img
                          src={currentImgUrl}
                          alt="Original photograph"
                          className="v4-preview-img"
                          width={width || 800}
                          height={height || 600}
                          decoding="async"
                          draggable={false}
                          style={{
                            filter: isGenerating ? 'brightness(0.85) contrast(1.05)' : 'none',
                            transition: 'filter 0.3s ease',
                          }}
                        />

                        {isGenerating && (
                          <>
                            {/* Scanning laser beam sweeping vertically across photograph */}
                            <div className="anim-scan-beam" />

                            {/* Corner coordinate reticles */}
                            <div className="anim-corner-reticle anim-corner-reticle--tl mono">[000, 000]</div>
                            <div className="anim-corner-reticle anim-corner-reticle--tr mono">[{width || 800}, 000]</div>
                            <div className="anim-corner-reticle anim-corner-reticle--bl mono">[000, {height || 600}]</div>
                            <div className="anim-corner-reticle anim-corner-reticle--br mono">[{width || 800}, {height || 600}]</div>

                            {/* Blueprint grid overlay */}
                            <svg
                              className="anim-structural-svg"
                              viewBox={`0 0 ${width || 800} ${height || 600}`}
                              preserveAspectRatio="none"
                              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                            >
                              <defs>
                                <pattern id="v4-anim-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="0.75" />
                                </pattern>
                              </defs>
                              <rect width="100%" height="100%" fill="url(#v4-anim-grid)" />
                            </svg>

                            {/* Center-Bottom Floating Glass HUD Badge */}
                            <div
                              className="mono"
                              style={{
                                position: 'absolute',
                                bottom: '16px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                backgroundColor: 'rgba(20, 17, 15, 0.92)',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid var(--accent)',
                                borderRadius: '3px',
                                padding: '8px 16px',
                                fontSize: '11px',
                                color: 'var(--paper)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                zIndex: 30,
                                whiteSpace: 'nowrap',
                                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.75), 0 0 10px rgba(255, 79, 46, 0.3)',
                              }}
                            >
                              <div className="anim-hud-dot" />
                              <span style={{ fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.05em' }}>
                                {mode === 'painting' ? 'PAINTING SYNTHESIS' : 'EXACT COPY RECREATION'}
                              </span>
                              <span style={{ color: 'var(--line-strong)' }}>|</span>
                              <span style={{ color: 'var(--paper-dim)' }}>
                                {generationStage || 'Synthesizing vector contours...'}
                              </span>
                            </div>
                          </>
                        )}

                        {!isGenerating && !effectiveSvgUrl && (
                          <div
                            className="mono"
                            style={{
                              position: 'absolute',
                              bottom: '16px',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              backgroundColor: 'rgba(20, 17, 15, 0.88)',
                              backdropFilter: 'blur(6px)',
                              border: '1px solid var(--line-strong)',
                              borderRadius: '2px',
                              padding: '6px 14px',
                              fontSize: '11px',
                              color: 'var(--paper)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              zIndex: 25,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--moss)' }} />
                            <span>Photo Calibrated • Ready for Synthesis</span>
                          </div>
                        )}
                      </div>
                    )}
                    <GeometryOverlay
                      width={width || 800}
                      height={height || 600}
                      mode={overlayMode}
                      geometryData={geometryData}
                      landmarks={landmarks}
                      svgPaths={layers}
                      accentColor={accentColor}
                    />
                  </div>
                )}

                {/* 2. Original Photo View */}
                {viewMode === 'photo' && (
                  <div className="v4-preview-wrapper">
                    <img
                      src={currentImgUrl}
                      alt="Original photograph"
                      className="v4-preview-img"
                      width={width || 800}
                      height={height || 600}
                      decoding="async"
                      draggable={false}
                    />
                    <GeometryOverlay
                      width={width || 800}
                      height={height || 600}
                      mode={overlayMode}
                      geometryData={geometryData}
                      landmarks={landmarks}
                      svgPaths={layers}
                      accentColor={accentColor}
                    />
                  </div>
                )}

                {/* 3. Side-by-Side View */}
                {viewMode === 'side-by-side' && (
                  <div className="v4-side-by-side-wrap">
                    <div className="v4-side-pane">
                      <span className="v4-side-pane__label mono">Original</span>
                      <img
                        src={currentImgUrl}
                        alt="Original photograph"
                        className="v4-preview-img"
                        width={width || 800}
                        height={height || 600}
                        decoding="async"
                        draggable={false}
                      />
                    </div>
                    <div className="v4-side-pane">
                      <span className="v4-side-pane__label mono">Result</span>
                      {effectiveSvgUrl && !isGenerating ? (
                        <img
                          src={effectiveSvgUrl}
                          alt="Vector reconstruction"
                          className="v4-preview-img"
                          width={width || 800}
                          height={height || 600}
                          decoding="async"
                          draggable={false}
                        />
                      ) : isGenerating ? (
                        <ThinkingOrb
                          mode={mode}
                          stage={generationStage}
                          progressPercent={_progressPercent}
                        />
                      ) : (
                        <EmptySvgState onGenerate={onGenerate || (() => {})} context="result" />
                      )}
                    </div>
                  </div>
                )}

                {/* 4. Wipe Slider View */}
                {viewMode === 'wipe-slider' && (
                  <div className="v4-wipe-slider-wrap" ref={sliderWrapRef}>
                    <img
                      src={currentImgUrl}
                      alt="Original photograph"
                      className="v4-wipe-image-base"
                      width={width || 800}
                      height={height || 600}
                      decoding="async"
                      draggable={false}
                    />
                    <div
                      className="v4-wipe-overlay"
                      style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
                    >
                      {effectiveSvgUrl ? (
                        <img
                          src={effectiveSvgUrl}
                          alt="Vector result"
                          className="v4-wipe-image-base"
                          width={width || 800}
                          height={height || 600}
                          decoding="async"
                          draggable={false}
                        />
                      ) : null}
                    </div>
                    <div className="v4-wipe-divider-handle" style={{ left: `${sliderPos}%` }}>
                      <div className="v4-wipe-handle-pill">
                        <SplitSquareVertical size={12} />
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. Diff View */}
                {viewMode === 'diff' &&
                  (diffBlobUrl ? (
                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <img
                        src={diffBlobUrl}
                        alt="Difference error map"
                        className="v4-preview-img"
                        width={width || 800}
                        height={height || 600}
                        decoding="async"
                        draggable={false}
                      />
                    </div>
                  ) : (
                    <MissingContentState
                      title="Difference Map Standby"
                      message="Vector reconstruction must be synthesized first before calculating pixel-level perceptual difference."
                      actionLabel="Generate Vector Artwork"
                      onAction={onGenerate}
                    />
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Result Caption: Plain mono text, one line, truncates with ellipsis and full text in tooltip */}
      <div className="v4-result-caption mono" title={captionText}>
        <span>{captionText}</span>
      </div>
    </div>
  );
};

export default V4ResultPane;
