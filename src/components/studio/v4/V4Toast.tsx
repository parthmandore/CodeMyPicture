import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'warn' | 'error';
  count?: number;
}

export interface V4ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const V4Toast: React.FC<V4ToastProps> = ({ toasts, onDismiss }) => {
  if (!toasts || toasts.length === 0) return null;

  return (
    <aside className="atelier-toast-container" role="region" aria-label="Workbench Notifications">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </aside>
  );
};

const ToastCard: React.FC<{ toast: ToastItem; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const [isFading, setIsFading] = useState(false);
  const isError = toast.type === 'error';

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsFading(true);
      setTimeout(onDismiss, 200);
    }, isError ? 4500 : 3200);

    return () => clearTimeout(timer);
  }, [onDismiss, isError]);

  const handleDismiss = () => {
    setIsFading(true);
    setTimeout(onDismiss, 160);
  };

  const typeClass =
    toast.type === 'warn'
      ? 'atelier-toast--warn'
      : toast.type === 'error'
      ? 'atelier-toast--error'
      : toast.type === 'success'
      ? 'atelier-toast--success'
      : '';

  const IconComp =
    toast.type === 'success'
      ? CheckCircle2
      : toast.type === 'error'
      ? AlertCircle
      : toast.type === 'warn'
      ? AlertTriangle
      : Info;

  return (
    <div
      className={`atelier-toast ${typeClass} ${isFading ? 'is-fading' : ''}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Escape' || e.key === 'Enter') {
          handleDismiss();
        }
      }}
    >
      <IconComp size={14} className="atelier-toast-icon" aria-hidden="true" />
      <span className="atelier-toast-msg">
        {toast.message}
        {toast.count && toast.count > 1 ? (
          <span className="mono atelier-toast-count">×{toast.count}</span>
        ) : null}
      </span>
      <button
        type="button"
        className="atelier-toast-close"
        onClick={handleDismiss}
        aria-label="Dismiss notification"
      >
        <X size={12} />
      </button>
    </div>
  );
};

export default V4Toast;
