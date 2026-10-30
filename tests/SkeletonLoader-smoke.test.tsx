import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkeletonLoaders } from '../src/renderer/components/SkeletonLoader';

describe('SkeletonLoader', () => {
  it('renders with aria-busy and aria-hidden', () => {
    render(<SkeletonLoaders count={2} />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(document.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThanOrEqual(2);
  });

  it('exports SkeletonLoaders function', async () => {
    const mod = await import('../src/renderer/components/SkeletonLoader');
    expect(typeof mod.SkeletonLoaders).toBe('function');
  });
});
