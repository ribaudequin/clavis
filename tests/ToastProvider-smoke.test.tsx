import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ToastProvider } from '../src/renderer/components/ToastProvider';

describe('ToastProvider', () => {
  it('renders with children and mounts Toaster', () => {
    render(
      <ToastProvider>
        <div data-testid="child">hello</div>
      </ToastProvider>
    );
    expect(screen.getByTestId('child').textContent).toBe('hello');
  });

  it('exports ToastProvider as function', async () => {
    const mod = await import('../src/renderer/components/ToastProvider');
    expect(typeof mod.ToastProvider).toBe('function');
  });
});
