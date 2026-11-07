import React from 'react';
import { Upload, Eye, Cpu, Sliders, Download, ArrowRight } from 'lucide-react';

export const WorkflowSection: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'Upload Photo',
      icon: <Upload size={16} />,
      desc: 'Ingest any portrait, figure, or scene photograph directly into browser memory (JPEG, PNG, WebP).',
    },
    {
      num: '02',
      title: 'Analyze Scene',
      icon: <Eye size={16} />,
      desc: 'In-browser vision tracks facial landmarks and Sobel gradient analysis maps full-image edge contours across hair, body, and background.',
    },
    {
      num: '03',
      title: 'Reconstruct in Code',
      icon: <Cpu size={16} />,
      desc: 'Background Web Workers execute multi-scale color quantization and subpixel vector path tracing in Painting or Recreation mode.',
    },
    {
      num: '04',
      title: 'Inspect SVG Geometry',
      icon: <Sliders size={16} />,
      desc: 'Interactive Studio Workbench with side-by-side view, wipe slider, zoom/pan navigation, and full-image geometry overlays.',
    },
    {
      num: '05',
      title: 'Export Production Code',
      icon: <Download size={16} />,
      desc: 'Download clean standalone SVG, self-contained HTML embed, production React JSX component, or high-res PNG.',
    },
  ];

  return (
    <section id="workflow" className="landing-section" aria-labelledby="workflow-heading">
      <div className="landing-section__header">
        <div className="landing-section__badge mono">
          <span>02 // EXECUTION PIPELINE</span>
        </div>
        <h2 id="workflow-heading" className="landing-section__title">
          Five-Stage Reconstruction Workflow
        </h2>
        <p className="landing-section__subtitle">
          From uploaded bitmap to clean mathematical vector code — completely automated, non-destructive, and executed client-side.
        </p>
      </div>

      <div className="landing-workflow-grid">
        {steps.map((st, idx) => (
          <div key={st.num} className="landing-workflow-card">
            <div className="landing-workflow-card__top">
              <span className="landing-workflow-num mono">{st.num}</span>
              <div className="landing-workflow-icon">{st.icon}</div>
            </div>
            <h3 className="landing-workflow-card__title">{st.title}</h3>
            <p className="landing-workflow-card__desc">{st.desc}</p>
            {idx < steps.length - 1 && (
              <div className="landing-workflow-connector" aria-hidden="true">
                <ArrowRight size={12} />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

export default WorkflowSection;
