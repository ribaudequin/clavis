// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

beforeEach(() => cleanup());
afterEach(() => cleanup());

vi.mock('../src/renderer/hooks/useFocusTrap', () => ({ useFocusTrap: () => {} }));
vi.mock('../src/renderer/hooks/useModalKeyboard', () => ({ useModalKeyboard: () => {} }));
import ViewDrawer from '../src/renderer/pages/ViewDrawer';

describe('ViewDrawer', () => {
  it('renders title and content inputs', () => {
    render(
      <ViewDrawer
        drawerId="1"
        password="pw"
        initialTitle="My Drawer"
        initialContent="Hello"
        onSave={async () => ({ ok: true, data: undefined })}
        onDelete={async () => ({ ok: true, data: undefined })}
        onBack={() => {}}
      />
    );
    expect(screen.getByDisplayValue('My Drawer')).toBeTruthy();
    expect(screen.getByDisplayValue('Hello')).toBeTruthy();
  });

  it('calls onBack when back clicked', () => {
    const onBack = vi.fn();
    render(
      <ViewDrawer
        drawerId="1"
        password="pw"
        initialTitle=""
        initialContent=""
        onSave={async () => ({ ok: true, data: undefined })}
        onDelete={async () => ({ ok: true, data: undefined })}
        onBack={onBack}
      />
    );
    fireEvent.click(screen.getByText('← Back'));
    expect(onBack).toHaveBeenCalled();
  });

  it('calls onSave with updated data', async () => {
    const onSave = vi.fn(async () => ({ ok: true, data: undefined }));
    render(
      <ViewDrawer
        drawerId="1"
        password="pw"
        initialTitle="T"
        initialContent="C"
        onSave={onSave}
        onDelete={async () => ({ ok: true, data: undefined })}
        onBack={() => {}}
      />
    );
    fireEvent.change(screen.getByDisplayValue('T'), { target: { value: 'Updated' } });
    fireEvent.change(screen.getByDisplayValue('C'), { target: { value: 'Updated content' } });
    await fireEvent.click(screen.getAllByText('Save drawer and back to menu')[0]);
    expect(onSave).toHaveBeenCalledWith('1', 'pw', 'Updated', 'Updated content');
  });

  it('shows delete button', () => {
    render(
      <ViewDrawer
        drawerId="1"
        password="pw"
        initialTitle="Del"
        initialContent=""
        onSave={async () => ({ ok: true, data: undefined })}
        onDelete={async () => ({ ok: true, data: undefined })}
        onBack={() => {}}
      />
    );
    expect(screen.getAllByText('delete drawer').length).toBeGreaterThan(0);
  });
});
