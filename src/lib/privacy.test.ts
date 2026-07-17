import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureDocumentSharingConsent } from './privacy';

describe('ensureDocumentSharingConsent', () => {
  afterEach(() => vi.restoreAllMocks());

  it('declines without granting consent', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const grant = vi.fn();

    expect(ensureDocumentSharingConsent(false, grant)).toBe(false);
    expect(grant).not.toHaveBeenCalled();
  });

  it('accepts and grants consent', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const grant = vi.fn();

    expect(ensureDocumentSharingConsent(false, grant)).toBe(true);
    expect(grant).toHaveBeenCalledOnce();
  });

  it('reuses session consent without prompting again', () => {
    const confirm = vi.spyOn(window, 'confirm');
    const grant = vi.fn();

    expect(ensureDocumentSharingConsent(true, grant)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(grant).not.toHaveBeenCalled();
  });
});
