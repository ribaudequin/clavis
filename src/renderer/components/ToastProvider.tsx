import React from 'react';
import { Toaster } from 'react-hot-toast';

export function ToastProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <>
      {children}
      <Toaster
        position="bottom-right"
        reverseOrderFamilies={false}
        toastOptions={{
          className: 'text-sm',
          duration: 4000,
          style: {
            background: '#fff',
            color: '#1f2937',
            border: '1px solid #e5e7eb',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
            padding: '12px 16px',
            borderRadius: '8px',
          },
          error: {
            style: {
              border: '1px solid #fca5a5',
              color: '#7f1d1d',
            },
            icon: '❌',
          },
          success: {
            style: {
              border: '1px solid #86efac',
              color: '#14532d',
            },
            icon: '✅',
          },
          loading: {
            style: {
              border: '1px solid #bfdbfe',
              color: '#1e3a8a',
            },
            icon: '⏳',
          },
        }}
      />
    </>
  );
}

export default ToastProvider;
