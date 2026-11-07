import React from 'react';
import { ShieldCheck, Cpu, ArrowRight, Layers, Terminal } from 'lucide-react';
import { FaceDetectionState } from '../../services/faceDetection/types';

export interface HeaderProps {
  currentView: 'upload' | 'studio';
  onViewChange: (view: 'upload' | 'studio') => void;
  hasValidImage: boolean;
  engineState: FaceDetectionState;
  onInitEngine?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  hasValidImage,
  engineState,
  onInitEngine,
}) => {
  // Determine engine badge status
  let engineLabel = 'WASM: Offline';
  let engineColor = 'var(--paper-dim)';

  if (engineState === 'ready') {
    engineLabel = 'WASM: Ready';
    engineColor = 'var(--moss)';
  } else if (engineState === 'initializing' || engineState === 'detecting') {
    engineLabel = engineState === 'detecting' ? 'Analyzing Face…' : 'Loading WASM…';
    engineColor = 'var(--amber)';
  } else if (engineState === 'error') {
    engineLabel = 'WASM: Error';
    engineColor = 'var(--rose)';
  } else if (engineState === 'uninitialized') {
    engineLabel = 'WASM: Standby';
    engineColor = 'var(--paper-dim)';
  }

  return (
    <header className="v4-header studio-header-unified" role="banner">
      <div className="v4-header__left">
        <div
          className="v4-wordmark"
          onClick={() => onViewChange('upload')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onViewChange('upload');
            }
          }}
          title="CodeMyPicture — Return to Photo Input"
        >
          CodeMy<em className="v4-wordmark-face">Picture</em>
        </div>

        <nav className="studio-header-nav" aria-label="Workbench Navigation">
          <button
            type="button"
            className={`v4-btn ${currentView === 'upload' ? 'is-active' : ''}`}
            onClick={() => onViewChange('upload')}
            aria-current={currentView === 'upload' ? 'page' : undefined}
          >
            <Layers size={13} style={{ marginRight: '4px', opacity: 0.7 }} />
            <span>01 // Input</span>
          </button>

          <button
            type="button"
            className={`v4-btn ${currentView === 'studio' ? 'is-active' : ''}`}
            onClick={() => onViewChange('studio')}
            disabled={!hasValidImage}
            title={hasValidImage ? 'Open Studio Workbench' : 'Upload an image first to open the workbench'}
            aria-current={currentView === 'studio' ? 'page' : undefined}
          >
            <Terminal size={13} style={{ marginRight: '4px', opacity: 0.7 }} />
            <span>02 // Workbench</span>
          </button>
        </nav>

        {currentView === 'upload' && (
          <nav className="studio-header-sections-nav" aria-label="Product Sections Navigation">
            <a href="#modes" className="studio-header-section-link" title="Jump to Painting vs Recreation Modes">Modes</a>
            <a href="#workflow" className="studio-header-section-link" title="Jump to Reconstruction Workflow">Workflow</a>
            <a href="#features" className="studio-header-section-link" title="Jump to Architecture & Features">Architecture</a>
            <a href="#privacy" className="studio-header-section-link" title="Jump to In-Browser Privacy">Privacy</a>
            <a href="#exports" className="studio-header-section-link" title="Jump to Export Formats">Exports</a>
          </nav>
        )}
      </div>

      <div className="v4-header__right">
        {/* Local Privacy Guarantee */}
        <div
          className="studio-header-status-badge mono"
          title="All processing occurs strictly inside your browser memory via WebAssembly and Web Workers. No photos are ever uploaded."
        >
          <ShieldCheck size={13} style={{ color: 'var(--moss)' }} />
          <span>100% Client-Side</span>
        </div>

        {/* Engine Status */}
        <div
          className="studio-header-status-badge mono"
          onClick={engineState === 'uninitialized' || engineState === 'error' ? onInitEngine : undefined}
          style={{ cursor: engineState === 'uninitialized' || engineState === 'error' ? 'pointer' : 'default' }}
          title={engineState === 'error' ? 'Click to retry engine initialization' : 'MediaPipe Vision WASM status'}
        >
          <span
            style={{
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: engineColor,
            }}
          />
          <Cpu size={12} style={{ color: engineColor }} />
          <span style={{ color: engineColor }}>{engineLabel}</span>
        </div>

        {/* Quick Launch CTA when photo is loaded */}
        {hasValidImage && currentView === 'upload' && (
          <button
            type="button"
            className="v4-btn v4-btn--accent"
            onClick={() => onViewChange('studio')}
            title="Open Studio Workbench"
          >
            <span>Open Workbench</span>
            <ArrowRight size={13} style={{ marginLeft: '4px' }} />
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;
