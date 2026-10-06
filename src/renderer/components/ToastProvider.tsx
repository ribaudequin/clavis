import React from 'react';
import { Toaster } from 'react-hot-toast';

export function ToastProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: 'text-sm',
          duration: 4000,
          style: {
            background: 'var(--surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
            padding: '12px 16px',
            borderRadius: '8px',
          },
          error: {
            style: {
              border: '1px solid var(--danger-border)',
              color: 'var(--danger-text)',
            },
            icon: '❌',
          },
          success: {
            style: {
              border: '1px solid var(--success-border)',
              color: 'var(--success-text)',
            },
            icon: '✅',
          },
          loading: {
            style: {
              border: '1px solid var(--info-border)',
              color: 'var(--info-text)',
            },
            icon: '⏳',
          },
        }}
      />
    </>
  );
}

export default ToastProvider;
