import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/renderer/hooks/useFocusTrap', () => ({ useFocusTrap: () => {} }));
vi.mock('../src/renderer/hooks/useModalKeyboard', () => ({ useModalKeyboard: () => {} }));

describe('CreateDrawerModal smoke', () => {
  it('exports a component function', async () => {
    const { default: Component } = await import('../src/renderer/components/CreateDrawerModal');
    expect(typeof Component).toBe('function');
  });
});
