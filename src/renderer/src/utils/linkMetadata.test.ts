import { describe, expect, it } from 'vitest';
import { detectLinkMetadata, getLinkPreview, linkIconUrl } from './linkMetadata';

describe('detectLinkMetadata', () => {
  it('detects supported meeting providers', () => {
    expect(detectLinkMetadata('https://meet.google.com/abc-defg-hij')?.kind).toBe('meet');
    expect(detectLinkMetadata('https://zoom.us/j/123')?.kind).toBe('zoom');
    expect(detectLinkMetadata('https://teams.microsoft.com/l/meetup-join/x')?.kind).toBe('teams');
    expect(detectLinkMetadata('https://example.com')?.kind).toBe('link');
  });

  it('accepts safe web and email links but rejects unsafe schemes', () => {
    expect(detectLinkMetadata('http://example.com')?.kind).toBe('link');
    expect(detectLinkMetadata('mailto:hello@example.com')?.kind).toBe('link');
    expect(detectLinkMetadata('javascript:alert(1)')).toBeNull();
    expect(detectLinkMetadata('not a url')).toBeNull();
  });

  it('builds a favicon URL only for safe web links', () => {
    expect(getLinkPreview('https://Example.com/path')?.imageUrl).toBe('https://www.google.com/s2/favicons?domain=example.com&sz=64');
    expect(linkIconUrl('mailto:test@example.com')).toBeNull();
  });
});
