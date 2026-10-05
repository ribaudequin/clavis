// @vitest-environment jsdom
// Why these tests do not simply "press Enter and expect one submit": jsdom does not
// implement implicit form submission, so Enter on the password input produces 0 submits
// (keydown, keypress and keyup were all probed). Such a test would pass while the
// duplicate-submit bug is still present, because it can only reach the hook's onEnter.
// The invariant is therefore proved in four parts: (G1) no onEnter is registered,
// (G2) Enter on a button does not submit, (G3) the native path submits exactly once
// and Enter on the input submits nothing through the hook, (G4) the isLoading guard
// blocks a concurrent second submit, (G5) an empty password never submits.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

type HookOptions = Parameters<typeof import('../src/renderer/hooks/useModalKeyboard').useModalKeyboard>[1];

const capturedOptions: NonNullable<HookOptions>[] = [];

vi.mock('../src/renderer/hooks/useModalKeyboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/renderer/hooks/useModalKeyboard')>();
  return {
    useModalKeyboard: (containerRef: React.RefObject<HTMLElement | null>, options?: HookOptions) => {
      capturedOptions.push(options ?? {});
      actual.useModalKeyboard(containerRef, options);
    },
  };
});

vi.mock('../src/renderer/hooks/useFocusTrap', () => ({ useFocusTrap: () => {} }));

import PasswordModal from '../src/renderer/components/PasswordModal';
import { t } from '../src/i18n';

beforeEach(() => {
  capturedOptions.length = 0;
  cleanup();
});
afterEach(() => cleanup());

function typePassword(value: string): HTMLInputElement {
  const input = screen.getByLabelText(t('label.password')) as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  return input;
}

function submitButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: t('btn.open') });
}

function visibilityToggle(): HTMLButtonElement {
  return screen.getByRole('button', { name: t('label.show_password') });
}

describe('PasswordModal — G1: no second Enter path registered', () => {
  it('never passes onEnter to useModalKeyboard', () => {
    render(<PasswordModal drawerTitle="Test" onClose={() => {}} onSubmit={async () => {}} error={null} />);
    expect(capturedOptions.length).toBeGreaterThan(0);
    for (const options of capturedOptions) {
      expect(Object.keys(options)).not.toContain('onEnter');
      expect('onEnter' in options).toBe(false);
    }
  });

  it('still passes onEscape so Escape keeps closing the modal', () => {
    const onClose = vi.fn();
    render(<PasswordModal drawerTitle="Test" onClose={onClose} onSubmit={async () => {}} error={null} />);
    expect(capturedOptions.some((options) => options.onEscape === onClose)).toBe(true);
    fireEvent.keyDown(screen.getByLabelText(t('label.password')), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('PasswordModal — G2: Enter on a button does not submit', () => {
  it('does not submit when Enter is pressed on the visibility toggle', () => {
    const onSubmit = vi.fn(async () => {});
    render(<PasswordModal drawerTitle="Test" onClose={() => {}} onSubmit={onSubmit} error={null} />);
    const input = typePassword('secret');
    fireEvent.keyDown(visibilityToggle(), { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input.type).toBe('password');
  });

  it('leaves the visibility toggle usable after Enter (no submit, click still toggles)', () => {
    const onSubmit = vi.fn(async () => {});
    render(<PasswordModal drawerTitle="Test" onClose={() => {}} onSubmit={onSubmit} error={null} />);
    const input = typePassword('secret');
    fireEvent.keyDown(visibilityToggle(), { key: 'Enter' });
    fireEvent.click(visibilityToggle());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input.type).toBe('text');
  });

  it('does not submit when Enter is pressed on the cancel button', () => {
    const onSubmit = vi.fn(async () => {});
    render(<PasswordModal drawerTitle="Test" onClose={() => {}} onSubmit={onSubmit} error={null} />);
    typePassword('secret');
    fireEvent.keyDown(screen.getByRole('button', { name: t('btn.cancel') }), { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('PasswordModal — G3: the native path submits exactly once', () => {
  it('submits once when the form is submitted natively', async () => {
    const onSubmit = vi.fn(async () => {});
    const { container } = render(
      <PasswordModal drawerTitle="Test" onClose={() => {}} onSubmit={onSubmit} error={null} />
    );
    typePassword('secret');
    const form = container.querySelector('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('secret');
  });

  it('submits once when the submit button is clicked', async () => {
    const onSubmit = vi.fn(async () => {});
    render(<PasswordModal drawerTitle="Test" onClose={() => {}} onSubmit={onSubmit} error={null} />);
    typePassword('secret');
    fireEvent.click(submitButton());
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not submit through the hook when Enter is pressed on the password input', () => {
    const onSubmit = vi.fn(async () => {});
    render(<PasswordModal drawerTitle="Test" onClose={() => {}} onSubmit={onSubmit} error={null} />);
    const input = typePassword('secret');
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyPress(input, { key: 'Enter' });
    fireEvent.keyUp(input, { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('PasswordModal — G4: the isLoading guard blocks a concurrent second submit', () => {
  it('ignores a second submit while the first is still pending', () => {
    let release: () => void = () => {};
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
    const { container } = render(
      <PasswordModal drawerTitle="Test" onClose={() => {}} onSubmit={onSubmit} error={null} />
    );
    typePassword('secret');
    const form = container.querySelector('form') as HTMLFormElement;

    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    release();
  });
});

describe('PasswordModal — G6: the in-flight button says "decrypting", not "importing"', () => {
  it('replaces the import wording while the unlock is pending', async () => {
    let release: () => void = () => {};
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
    render(<PasswordModal drawerTitle="Test" onClose={() => {}} onSubmit={onSubmit} error={null} />);
    typePassword('secret');
    fireEvent.click(submitButton());

    await act(async () => {});
    const pending = screen.getByRole('button', { name: t('btn.decrypting') });
    expect(pending.textContent).toMatch(/desencriptar|decrypting/i);
    expect(pending.textContent).not.toBe(t('btn.importing'));

    await act(async () => {
      release();
    });
    expect(submitButton().textContent).toMatch(/abrir|open/i);
  });
});

describe('PasswordModal — G5: empty and whitespace passwords never submit', () => {
  it('does not submit an empty password', () => {
    const onSubmit = vi.fn(async () => {});
    const { container } = render(
      <PasswordModal drawerTitle="Test" onClose={() => {}} onSubmit={onSubmit} error={null} />
    );
    const form = container.querySelector('form') as HTMLFormElement;
    typePassword('');
    fireEvent.submit(form);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not submit a whitespace-only password', () => {
    const onSubmit = vi.fn(async () => {});
    const { container } = render(
      <PasswordModal drawerTitle="Test" onClose={() => {}} onSubmit={onSubmit} error={null} />
    );
    const form = container.querySelector('form') as HTMLFormElement;
    typePassword('   ');
    fireEvent.submit(form);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});