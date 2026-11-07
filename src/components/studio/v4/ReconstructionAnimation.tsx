import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { WorkbenchStatus } from '../../../engine/v4/types';
import { NormalizedLandmark } from '../../../services/faceDetection';
import '../../../styles/reconstructionAnimation.css';

export interface SampledColorItem {
  id: string;
  label: string;
  hex: string;
  xPct: number;
  yPct: number;
}

export type AnimationVisualStage =
  | 'source-acquisition'
  | 'structural-analysis'
  | 'color-sampling'
  | 'vector-synthesis'
  | 'final-reveal'
  | 'complete';

export interface UseReconstructionAnimationOptions {
  isGenerating: boolean;
  status?: WorkbenchStatus;
  generationStage: string;
  underpaintingLayers?: Array<{ layerId: string; colorHex: string; d: string; opacity?: number }>;
  colorMetrics?: {
    skin?: { hex: string; r: number; g: number; b: number };
    lips?: { hex: string; r: number; g: number; b: number };
    hair?: { hex: string; r: number; g: number; b: number };
    bg?: { hex: string; r: number; g: number; b: number };
  };
  landmarks?: NormalizedLandmark[];
  accentColor?: string;
  onRevealFinished?: () => void;
}

export function useReconstructionAnimationState({
  isGenerating,
  status,
  generationStage,
  underpaintingLayers = [],
  colorMetrics,
  landmarks = [],
  accentColor = '#FF4F2E',
  onRevealFinished,
}: UseReconstructionAnimationOptions) {
  const [visualStage, setVisualStage] = useState<AnimationVisualStage>('source-acquisition');
  const [revealWipeX, setRevealWipeX] = useState<number>(0);
  const wipeStartRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const isWipingRef = useRef<boolean>(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, []);

  // Update visual stage based on real engine events
  useEffect(() => {
    if (!isGenerating && status === 'done') {
      if (visualStage !== 'final-reveal' && visualStage !== 'complete') {
        setVisualStage('final-reveal');
      }
      return;
    }

    if (!isGenerating) {
      setVisualStage('source-acquisition');
      isWipingRef.current = false;
      return;
    }

    const stageLower = generationStage.toLowerCase();

    if (
      stageLower.includes('underpainting') ||
      stageLower.includes('blocking') ||
      stageLower.includes('modelling') ||
      stageLower.includes('details') ||
      stageLower.includes('varnish') ||
      stageLower.includes('tracing') ||
      (underpaintingLayers && underpaintingLayers.length > 0)
    ) {
      setVisualStage('vector-synthesis');
    } else if (
      stageLower.includes('color') ||
      stageLower.includes('palette') ||
      stageLower.includes('spawning') ||
      (colorMetrics && (colorMetrics.skin || colorMetrics.hair))
    ) {
      setVisualStage('color-sampling');
    } else if (
      stageLower.includes('landmark') ||
      stageLower.includes('geometry') ||
      stageLower.includes('mediapipe') ||
      stageLower.includes('segmenting') ||
      (landmarks && landmarks.length > 0)
    ) {
      setVisualStage('structural-analysis');
    } else {
      setVisualStage('source-acquisition');
    }
  }, [isGenerating, generationStage, status, underpaintingLayers, colorMetrics, landmarks, visualStage]);

  // Stage 5: Final Reveal Transition (Wipe 0% -> 100%)
  useEffect(() => {
    if (visualStage === 'final-reveal' && !isWipingRef.current) {
      isWipingRef.current = true;
      wipeStartRef.current = null;

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion) {
        setRevealWipeX(100);
        setVisualStage('complete');
        onRevealFinished?.();
        return;
      }

      const durationMs = 500; // 500ms smooth reveal wipe

      const stepWipe = (time: number) => {
        if (!isMountedRef.current) return;
        if (wipeStartRef.current === null) {
          wipeStartRef.current = time;
        }
        const elapsed = time - wipeStartRef.current;
        const progress = Math.min(1, elapsed / durationMs);
        const eased = 1 - Math.pow(1 - progress, 3);
        setRevealWipeX(eased * 100);

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(stepWipe);
        } else {
          setRevealWipeX(100);
          setVisualStage('complete');
          animFrameRef.current = null;
          onRevealFinished?.();
        }
      };

      animFrameRef.current = requestAnimationFrame(stepWipe);
    }

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [visualStage, onRevealFinished]);

  const handleSkip = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setRevealWipeX(100);
    setVisualStage('complete');
    onRevealFinished?.();
  }, [onRevealFinished]);

  // Genuine Sampled Colors
  const genuineColors: SampledColorItem[] = useMemo(() => {
    const list: SampledColorItem[] = [];

    const skinPt = landmarks && landmarks[1] ? { xPct: Math.round(landmarks[1].x * 100), yPct: Math.round(landmarks[1].y * 100) } : { xPct: 50, yPct: 44 };
    const hairPt = landmarks && landmarks[10] ? { xPct: Math.round(landmarks[10].x * 100), yPct: Math.max(6, Math.round(landmarks[10].y * 100 - 8)) } : { xPct: 35, yPct: 18 };
    const lipsPt = landmarks && landmarks[17] ? { xPct: Math.round(landmarks[17].x * 100), yPct: Math.round(landmarks[17].y * 100) } : { xPct: 50, yPct: 62 };

    if (colorMetrics?.skin?.hex) {
      list.push({
        id: 'skin',
        label: 'Biometric Skin',
        hex: colorMetrics.skin.hex,
        xPct: skinPt.xPct,
        yPct: skinPt.yPct,
      });
    }

    if (colorMetrics?.hair?.hex) {
      list.push({
        id: 'hair',
        label: 'Hair Volume',
        hex: colorMetrics.hair.hex,
        xPct: hairPt.xPct,
        yPct: hairPt.yPct,
      });
    }

    if (colorMetrics?.lips?.hex) {
      list.push({
        id: 'lips',
        label: 'Vermilion Lip',
        hex: colorMetrics.lips.hex,
        xPct: lipsPt.xPct,
        yPct: lipsPt.yPct,
      });
    }

    if (colorMetrics?.bg?.hex) {
      list.push({
        id: 'bg',
        label: 'Ambient Backing',
        hex: colorMetrics.bg.hex,
        xPct: 12,
        yPct: 12,
      });
    }

    if (accentColor && accentColor !== '#FF4F2E') {
      list.push({
        id: 'accent',
        label: 'Dominant Accent',
        hex: accentColor,
        xPct: 82,
        yPct: 80,
      });
    }

    if (list.length === 0) {
      list.push(
        { id: 'ambient-1', label: 'Tonal Plane 1', hex: '#8A7A6E', xPct: 50, yPct: 50 },
        { id: 'ambient-2', label: 'Tonal Plane 2', hex: '#4B423C', xPct: 25, yPct: 30 },
        { id: 'ambient-3', label: 'Tonal Plane 3', hex: '#C2B6A5', xPct: 75, yPct: 40 },
        { id: 'ambient-4', label: 'Background', hex: '#26211D', xPct: 10, yPct: 10 }
      );
    }

    return list;
  }, [colorMetrics, accentColor, landmarks]);

  return {
    visualStage,
    revealWipeX,
    genuineColors,
    handleSkip,
  };
}

/* --------------------------------------------------------------------------
   HUD Status Pill & Technical Docked Palette Bar
   -------------------------------------------------------------------------- */
export interface ReconstructionAnimationHUDProps {
  mode?: 'painting' | 'recreation';
  generationStage: string;
  visualStage: AnimationVisualStage;
  genuineColors: SampledColorItem[];
  onSkip?: () => void;
}

export const ReconstructionAnimationHUD: React.FC<ReconstructionAnimationHUDProps> = ({
  mode = 'painting',
  generationStage,
  visualStage,
  genuineColors,
  onSkip,
}) => {
  const stageTagMap: Record<AnimationVisualStage, string> = {
    'source-acquisition': 'STAGE 1/5 // SOURCE ACQUISITION',
    'structural-analysis': 'STAGE 2/5 // STRUCTURAL MESH',
    'color-sampling': 'STAGE 3/5 // COLOR EXTRACTION',
    'vector-synthesis': 'STAGE 4/5 // VECTOR SYNTHESIS',
    'final-reveal': 'STAGE 5/5 // FINAL REVEAL',
    'complete': 'COMPLETE',
  };

  return (
    <>
      {/* 1. Atelier HUD Header */}
      <div className="anim-hud-header mono">
        <div className="anim-hud-stage-pill">
          <span className="anim-hud-dot" aria-hidden="true" />
          <span className="anim-hud-stage-tag">{stageTagMap[visualStage]}</span>
          <span className="anim-hud-stage-msg" title={generationStage}>
            — {generationStage || 'Calibrating input image buffer…'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="anim-hud-mode-badge">
            <span>ENGINE:</span>
            <span className="mode-tag">
              {mode === 'recreation' ? 'PHOTOGRAPHIC RECREATION' : 'PAINTING ATELIER'}
            </span>
          </div>

          {visualStage === 'final-reveal' && (
            <button
              type="button"
              className="anim-skip-btn mono"
              onClick={onSkip}
              title="Skip wipe reveal"
            >
              SKIP ➔
            </button>
          )}
        </div>
      </div>

      {/* 2. Docked Technical Palette Strip */}
      {(visualStage === 'color-sampling' || visualStage === 'vector-synthesis') && (
        <div className="anim-palette-dock mono">
          <div className="anim-palette-dock__title">
            <span>COLORSPACE: CIELAB ΔE PERCEPTUAL SAMPLING</span>
            <span>{genuineColors.length} SAMPLES</span>
          </div>

          <div className="anim-palette-chips-row">
            {genuineColors.map((c) => (
              <div key={c.id} className="anim-color-chip">
                <div
                  className="anim-color-chip__swatch"
                  style={{ backgroundColor: c.hex }}
                />
                <span className="anim-color-chip__label">{c.label}</span>
                <span className="anim-color-chip__hex">{c.hex}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

/* --------------------------------------------------------------------------
   Image-Aligned Reconstruction Overlay
   -------------------------------------------------------------------------- */
export interface ReconstructionAnimationOverlayProps {
  width: number;
  height: number;
  mode?: 'painting' | 'recreation';
  visualStage: AnimationVisualStage;
  landmarks?: NormalizedLandmark[];
  genuineColors: SampledColorItem[];
  underpaintingLayers?: Array<{ layerId: string; colorHex: string; d: string; opacity?: number }>;
  svgBlobUrl?: string;
  revealWipeX: number;
}

export const ReconstructionAnimationOverlay: React.FC<ReconstructionAnimationOverlayProps> = ({
  width,
  height,
  mode = 'painting',
  visualStage,
  landmarks = [],
  genuineColors,
  underpaintingLayers = [],
  svgBlobUrl,
  revealWipeX,
}) => {
  // Generate Full-Composition Structural Mesh (Stage 2)
  const fullMesh = useMemo(() => {
    const meshPoints: Array<{ x: number; y: number; isKey?: boolean }> = [];
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number; type: 'rule' | 'diag' | 'face' }> = [];

    const gridCols = 4;
    const gridRows = 4;
    for (let c = 0; c <= gridCols; c++) {
      for (let r = 0; r <= gridRows; r++) {
        const px = (c / gridCols) * width;
        const py = (r / gridRows) * height;
        meshPoints.push({ x: px, y: py });
      }
    }

    for (let c = 0; c < gridCols; c++) {
      for (let r = 0; r < gridRows; r++) {
        const x1 = (c / gridCols) * width;
        const y1 = (r / gridRows) * height;
        const x2 = ((c + 1) / gridCols) * width;
        const y2 = (r / gridRows) * height;
        const x3 = (c / gridCols) * width;
        const y3 = ((r + 1) / gridRows) * height;
        const x4 = ((c + 1) / gridCols) * width;
        const y4 = ((r + 1) / gridRows) * height;

        lines.push({ x1, y1, x2, y2, type: 'rule' });
        lines.push({ x1, y1, x2: x3, y2: y3, type: 'rule' });
        lines.push({ x1, y1, x2: x4, y2: y4, type: 'diag' });
      }
    }

    if (landmarks && landmarks.length > 0) {
      const sampleIndices = [
        10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
        400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
        54, 103, 67, 109, 1, 4, 5, 195, 197, 6, 168, 8, 9, 151
      ];

      for (let i = 0; i < sampleIndices.length; i++) {
        const idx = sampleIndices[i];
        const pt = landmarks[idx];
        if (pt) {
          const px = pt.x * width;
          const py = pt.y * height;
          meshPoints.push({ x: px, y: py, isKey: true });

          if (i > 0) {
            const prevIdx = sampleIndices[i - 1];
            const prevPt = landmarks[prevIdx];
            if (prevPt) {
              lines.push({
                x1: prevPt.x * width,
                y1: prevPt.y * height,
                x2: px,
                y2: py,
                type: 'face',
              });
            }
          }
        }
      }
    }

    return { points: meshPoints, lines };
  }, [width, height, landmarks]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* STAGE 1: Source Acquisition — Scanning Beam & Dimension Callouts */}
      {(visualStage === 'source-acquisition' || visualStage === 'structural-analysis') && (
        <>
          <div className="anim-scan-beam" aria-hidden="true" />
          <div className="anim-corner-reticle anim-corner-reticle--tl mono">[000, 000]</div>
          <div className="anim-corner-reticle anim-corner-reticle--tr mono">[{width}, 000]</div>
          <div className="anim-corner-reticle anim-corner-reticle--bl mono">[000, {height}]</div>
          <div className="anim-corner-reticle anim-corner-reticle--br mono">[{width}, {height}]</div>
          <div className="anim-dimension-tag mono">
            FRAME CALIBRATION: {width} × {height} PX
          </div>
        </>
      )}

      {/* STAGE 2: Structural Analysis — Full-Composition Geometric Mesh */}
      {(visualStage === 'structural-analysis' || visualStage === 'color-sampling') && (
        <svg
          className="anim-structural-svg"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          {fullMesh.lines.map((ln, idx) => (
            <line
              key={`ln-${idx}`}
              x1={ln.x1}
              y1={ln.y1}
              x2={ln.x2}
              y2={ln.y2}
              className={`anim-mesh-edge ${
                ln.type === 'face'
                  ? 'anim-mesh-edge--face'
                  : ln.type === 'diag'
                  ? 'anim-mesh-edge--accent'
                  : ''
              }`}
            />
          ))}

          {fullMesh.points.map((pt, idx) => (
            <circle
              key={`pt-${idx}`}
              cx={pt.x}
              cy={pt.y}
              r={pt.isKey ? 2.5 : 1.5}
              className={`anim-mesh-node ${pt.isKey ? 'anim-mesh-node--key' : ''}`}
            />
          ))}
        </svg>
      )}

      {/* STAGE 3: Color Sampling Reticles over Exact Photo Coordinates */}
      {(visualStage === 'color-sampling' || visualStage === 'vector-synthesis') && (
        <>
          {genuineColors.map((item) => (
            <div
              key={`reticle-${item.id}`}
              className="anim-sample-reticle"
              style={{
                left: `${item.xPct}%`,
                top: `${item.yPct}%`,
                borderColor: item.hex,
              }}
              title={`Sampled: ${item.label} (${item.hex})`}
            />
          ))}
        </>
      )}

      {/* STAGE 4: Vector Synthesis — Real Underpainting & Progressive Paths */}
      {visualStage === 'vector-synthesis' && underpaintingLayers.length > 0 && (
        <div className="anim-vector-stage">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{ width: '100%', height: '100%' }}
            preserveAspectRatio="xMidYMid meet"
          >
            {underpaintingLayers.slice(0, 60).map((l, idx) => (
              <path
                key={l.layerId || idx}
                d={l.d}
                fill={mode === 'recreation' && idx % 3 === 0 ? 'none' : l.colorHex}
                stroke={mode === 'recreation' ? l.colorHex : undefined}
                strokeWidth={mode === 'recreation' ? 0.75 : undefined}
                opacity={l.opacity ?? 0.88}
                className={`anim-vector-path ${
                  mode === 'recreation' ? 'anim-vector-path--recreation' : ''
                }`}
              />
            ))}
          </svg>

          <div className="anim-vector-stat-tag mono">
            {mode === 'recreation'
              ? `MICRO-DETAIL SYNTHESIS: ${underpaintingLayers.length} CONTOURS`
              : `ORGANIC SYNTHESIS: ${underpaintingLayers.length} TONAL PLANES`}
          </div>
        </div>
      )}

      {/* STAGE 5: Final Reveal Transition (Smooth Hairline Wipe) */}
      {visualStage === 'final-reveal' && (
        <>
          <div
            className="anim-reveal-wipe-bar"
            style={{ left: `${revealWipeX}%` }}
          >
            <div className="anim-reveal-wipe-tag mono">
              SVG REVEAL {Math.round(revealWipeX)}%
            </div>
          </div>

          {svgBlobUrl && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                clipPath: `polygon(0 0, ${revealWipeX}% 0, ${revealWipeX}% 100%, 0 100%)`,
                pointerEvents: 'none',
              }}
            >
              <img
                src={svgBlobUrl}
                alt="Synthesized SVG Vector Output"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                decoding="async"
                draggable={false}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};
