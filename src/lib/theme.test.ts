import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, resolveTheme } from './theme';

describe('theme handling', () => {
  afterEach(() => { document.documentElement.removeAttribute('data-theme'); vi.restoreAllMocks(); });
  it('uses the system preference and applies manual themes', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    expect(resolveTheme('system')).toBe('dark');
    const cleanup = applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    cleanup();
  });
});
