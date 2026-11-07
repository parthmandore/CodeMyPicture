import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';

export type ToastType = 'info' | 'success' | 'warn' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  timestamp: number;
  count?: number;
  durationMs?: number;
}

export interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (message: string, type?: ToastType, durationMs?: number) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  success: (message: string, durationMs?: number) => void;
  error: (message: string, durationMs?: number) => void;
  info: (message: string, durationMs?: number) => void;
  warn: (message: string, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEDUPE_WINDOW_MS = 2500;
const DEFAULT_DURATION_MS = 3200;
const MAX_VISIBLE_TOASTS = 4;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    const existingTimeout = timeoutsRef.current.get(id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      timeoutsRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    timeoutsRef.current.forEach((t) => clearTimeout(t));
    timeoutsRef.current.clear();
    setToasts([]);
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', durationMs: number = DEFAULT_DURATION_MS) => {
      const now = Date.now();

      setToasts((prev) => {
        // Check for duplicate message and type within window
        const existingIndex = prev.findIndex(
          (t) => t.message === message && t.type === type && now - t.timestamp < DEDUPE_WINDOW_MS
        );

        if (existingIndex !== -1) {
          const updated = [...prev];
          const existing = updated[existingIndex];
          const newCount = (existing.count || 1) + 1;

          // Reset dismiss timeout
          const currentTimeout = timeoutsRef.current.get(existing.id);
          if (currentTimeout) {
            clearTimeout(currentTimeout);
          }
          const newTimeout = setTimeout(() => {
            removeToast(existing.id);
          }, durationMs);
          timeoutsRef.current.set(existing.id, newTimeout);

          updated[existingIndex] = {
            ...existing,
            timestamp: now,
            count: newCount,
          };
          return updated;
        }

        // New toast
        const id = Math.random().toString(36).substring(2, 9);
        const newToast: ToastItem = {
          id,
          message,
          type,
          timestamp: now,
          count: 1,
          durationMs,
        };

        const timeout = setTimeout(() => {
          removeToast(id);
        }, durationMs);
        timeoutsRef.current.set(id, timeout);

        const next = [...prev, newToast];
        if (next.length > MAX_VISIBLE_TOASTS) {
          const oldest = next[0];
          const oldTimeout = timeoutsRef.current.get(oldest.id);
          if (oldTimeout) {
            clearTimeout(oldTimeout);
            timeoutsRef.current.delete(oldest.id);
          }
          return next.slice(-MAX_VISIBLE_TOASTS);
        }
        return next;
      });
    },
    [removeToast]
  );

  const success = useCallback((msg: string, dur?: number) => showToast(msg, 'success', dur), [showToast]);
  const error = useCallback((msg: string, dur?: number) => showToast(msg, 'error', dur ?? 4500), [showToast]);
  const info = useCallback((msg: string, dur?: number) => showToast(msg, 'info', dur), [showToast]);
  const warn = useCallback((msg: string, dur?: number) => showToast(msg, 'warn', dur ?? 4000), [showToast]);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        removeToast,
        clearToasts,
        success,
        error,
        info,
        warn,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};

// Accessible Toast Container
const ToastContainer: React.FC<{
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <aside
      className="atelier-toast-portal"
      aria-label="Notifications"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'none',
        maxWidth: '420px',
        width: 'calc(100vw - 48px)',
      }}
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </aside>
  );
};

const ToastCard: React.FC<{ toast: ToastItem; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const isError = toast.type === 'error';

  let borderColor = 'var(--line)';
  let accentColor = 'var(--vermilion)';
  let IconComponent = Info;

  if (toast.type === 'success') {
    borderColor = 'rgba(157, 180, 138, 0.4)';
    accentColor = 'var(--moss)';
    IconComponent = CheckCircle2;
  } else if (toast.type === 'error') {
    borderColor = 'rgba(224, 82, 82, 0.5)';
    accentColor = 'var(--rose)';
    IconComponent = AlertCircle;
  } else if (toast.type === 'warn') {
    borderColor = 'rgba(226, 160, 63, 0.4)';
    accentColor = 'var(--amber)';
    IconComponent = AlertTriangle;
  }

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      style={{
        pointerEvents: 'auto',
        backgroundColor: 'var(--ink-2, #1C1815)',
        border: `1px solid ${borderColor}`,
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: '3px',
        padding: '10px 14px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        color: 'var(--paper, #ECE5D6)',
        fontSize: '13px',
        lineHeight: 1.4,
        fontFamily: 'var(--font-sans)',
        animation: 'atelierToastIn 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
        <IconComponent size={15} style={{ color: accentColor, flexShrink: 0 }} aria-hidden="true" />
        <span style={{ wordBreak: 'break-word' }}>
          {toast.message}
          {toast.count && toast.count > 1 ? (
            <span
              className="mono"
              style={{
                marginLeft: '8px',
                fontSize: '11px',
                background: 'var(--ink-3)',
                padding: '1px 5px',
                borderRadius: '2px',
                color: 'var(--paper-dim)',
                border: '1px solid var(--line)',
              }}
            >
              ×{toast.count}
            </span>
          ) : null}
        </span>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--paper-muted)',
          cursor: 'pointer',
          padding: '3px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '2px',
          flexShrink: 0,
        }}
      >
        <X size={13} />
      </button>
    </div>
  );
};
