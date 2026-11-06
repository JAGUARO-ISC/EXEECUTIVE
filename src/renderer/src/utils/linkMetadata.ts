export type LinkKind = 'meet' | 'zoom' | 'teams' | 'webex' | 'link';

export interface LinkMetadata {
  kind: LinkKind;
  label: string;
  icon: string;
}

export function detectLinkMetadata(value: string): LinkMetadata | null {
  try {
    const url = new URL(value.trim());
    if (!['https:', 'http:', 'mailto:'].includes(url.protocol)) return null;
    if (url.protocol === 'mailto:') return { kind: 'link', label: 'Email', icon: 'link' };
    const host = url.hostname.toLowerCase();
    if (host === 'meet.google.com' || host.endsWith('.meet.google.com')) return { kind: 'meet', label: 'Google Meet', icon: 'video' };
    if (host === 'zoom.us' || host.endsWith('.zoom.us')) return { kind: 'zoom', label: 'Zoom', icon: 'video' };
    if (host === 'teams.microsoft.com' || host.endsWith('.teams.microsoft.com')) return { kind: 'teams', label: 'Microsoft Teams', icon: 'video' };
    if (host === 'webex.com' || host.endsWith('.webex.com')) return { kind: 'webex', label: 'Webex', icon: 'video' };
    return { kind: 'link', label: host, icon: 'link' };
  } catch {
    return null;
  }
}
