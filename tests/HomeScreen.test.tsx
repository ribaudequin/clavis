// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import HomeScreen from '../src/renderer/pages/HomeScreen';
import { DrawerListItem, Result, EncryptedDrawer } from '../src/shared/types';

let mockDrawers: DrawerListItem[];

function buildStub(): Window['electronAPI'] {
  return {
    listDrawers: async (): Promise<Result<DrawerListItem[]>> => ({ ok: true, data: mockDrawers }),
    createDrawer: async (): Promise<Result<EncryptedDrawer>> => ({ ok: true, data: { id: 'x', title: '', iconData: '', createdAt: 0, updatedAt: 0, encryptedData: '', salt: '', iv: '', authTag: '', keyDerivation: { algorithm: 'argon2id', iterations: 3, memory: 65536, parallelism: 1 } } }),
    unlockDrawer: async (): Promise<Result<{ title: string; content: string; iconData: string } | null>> => ({ ok: true, data: null }),
    saveDrawer: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    deleteDrawer: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    exportDrawer: async (): Promise<Result<string>> => ({ ok: true, data: '' }),
    importDrawer: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    openFile: async (): Promise<Result<{ token: string; fileName: string } | null>> => ({ ok: true, data: null }),
  };
}

beforeEach(() => {
  mockDrawers = [];
  window.electronAPI = buildStub();
});

afterEach(() => {
  cleanup();
});

describe('HomeScreen', () => {
  it('renders the title "Clavis" and the "New Drawer" button', async () => {
    render(<HomeScreen />);

    expect(screen.getByText('Clavis')).toBeTruthy();
    expect(screen.getByText('New Drawer')).toBeTruthy();
  });

  it('renders a drawer title when one drawer exists', async () => {
    mockDrawers = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Banco Central',
        iconData: '["rgb(1,2,3)","rgb(4,5,6)","rgb(7,8,9)","rgb(10,11,12)","rgb(13,14,15)","rgb(16,17,18)","rgb(19,20,21)","rgb(22,23,24)","rgb(25,26,27)"]',
      },
    ];

    render(<HomeScreen />);

    expect(await screen.findByText('Banco Central')).toBeTruthy();
    expect(screen.getByText('New Drawer')).toBeTruthy();
  });
});
