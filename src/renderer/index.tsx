import React from 'react';
import { createRoot } from 'react-dom/client';
import HomeScreen from './pages/HomeScreen';
import ErrorBoundary from './components/ErrorBoundary';

import './index.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HomeScreen />
    </ErrorBoundary>
  </React.StrictMode>,
);
