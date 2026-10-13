import React from 'react';
import { createRoot } from 'react-dom/client';
import HomeScreen from './pages/HomeScreen';
import ErrorBoundary from './components/ErrorBoundary';
import ToastProvider from './components/ToastProvider';
import { applyDocumentLanguage } from '../i18n';

import './index.css';

applyDocumentLanguage();

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <HomeScreen />
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
