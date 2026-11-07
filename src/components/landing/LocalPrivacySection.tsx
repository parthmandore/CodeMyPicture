import React from 'react';
import { ShieldCheck, Cpu, HardDrive, Lock } from 'lucide-react';

export const LocalPrivacySection: React.FC = () => {
  return (
    <section id="privacy" className="landing-section landing-privacy-section" aria-labelledby="privacy-heading">
      <div className="landing-privacy-banner">
        <div className="landing-privacy-banner__left">
          <div className="landing-privacy-badge mono">
            <ShieldCheck size={14} style={{ color: 'var(--moss)' }} />
            <span>VERIFIED CLIENT-SIDE EXECUTION</span>
          </div>
          <h2 id="privacy-heading" className="landing-privacy-title">
            100% In-Browser Privacy by Architecture
          </h2>
          <p className="landing-privacy-desc">
            CodeMyPicture operates entirely inside your local web browser session.
            We do not maintain remote processing servers, database storage, or external telemetry pipelines for your images.
          </p>
        </div>

        <div className="landing-privacy-points mono">
          <div className="privacy-point-item">
            <Cpu size={14} className="privacy-point-icon" />
            <div>
              <strong>In-Memory WebAssembly & Web Workers</strong>
              <p>Computer vision, color quantization, and SVG tracing run strictly in local device CPU/WASM threads.</p>
            </div>
          </div>

          <div className="privacy-point-item">
            <Lock size={14} className="privacy-point-icon" />
            <div>
              <strong>Zero Server Uploads or Storage</strong>
              <p>No image pixels, biometric vectors, or rendered files are ever transmitted to remote endpoints.</p>
            </div>
          </div>

          <div className="privacy-point-item">
            <HardDrive size={14} className="privacy-point-icon" />
            <div>
              <strong>Ephemeral Object Lifecycles</strong>
              <p>Image memory references and browser object URLs are immediately revoked upon clearing or replacing the photo.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LocalPrivacySection;
