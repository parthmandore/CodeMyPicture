import React, { useState, useEffect } from 'react';
import '../../../styles/thinkingOrb.css';

export interface ThinkingOrbProps {
  mode?: 'painting' | 'recreation';
  stage?: string;
  progressPercent?: number;
}

export const ThinkingOrb: React.FC<ThinkingOrbProps> = ({
  mode = 'painting',
  stage,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startTime = performance.now();
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((performance.now() - startTime) / 100) / 10);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="thinking-orb-container" role="status" aria-label="Vector synthesis in progress">
      <div className="thinking-orb-stage">
        {/* Ambient Glow Aura */}
        <div className="thinking-orb-aura" />

        {/* Concentric Orbital Rings */}
        <div className="thinking-orb-ring thinking-orb-ring--outer" />
        <div className="thinking-orb-ring thinking-orb-ring--inner" />

        {/* The Dynamic Thinking Orb Core */}
        <div className="thinking-orb-core">
          <div className="thinking-orb-fluid-layer thinking-orb-fluid-layer--1" />
          <div className="thinking-orb-fluid-layer thinking-orb-fluid-layer--2" />
          <div className="thinking-orb-specular" />
        </div>

        {/* Ambient Floating Micro-particles */}
        <div className="thinking-orb-particle thinking-orb-particle--1" />
        <div className="thinking-orb-particle thinking-orb-particle--2" />
        <div className="thinking-orb-particle thinking-orb-particle--3" />
      </div>

      {/* Status & Telemetry HUD */}
      <div className="thinking-orb-hud mono">
        <div className="thinking-orb-status-pill">
          <span className="thinking-orb-live-dot" />
          <span className="thinking-orb-status-title">
            Working... <span className="thinking-orb-timer">{elapsedSeconds.toFixed(1)} s</span>
          </span>
        </div>

        <div className="thinking-orb-mode-tag">
          {mode === 'painting' ? 'ORGANIC PAINTING STUDIO' : 'EXACT VECTOR RECREATION'}
        </div>

        <div className="thinking-orb-stage-detail">
          {stage || (mode === 'painting' ? 'Synthesizing organic planar strokes...' : 'Computing high-density vector paths...')}
        </div>
      </div>
    </div>
  );
};
