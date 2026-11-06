import { create } from 'zustand';

export const avatarInitials = (firstName: string, lastName: string): string =>
  `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase() || '?';

type ProfileFields = Pick<ProfileState, 'firstName' | 'lastName' | 'color' | 'imageData'>;

const storedProfile = (): Partial<ProfileFields> => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('exec_profile') ?? '{}');
    if (!value || typeof value !== 'object') return {};
    const profile = value as Partial<ProfileFields>;
    return {
      firstName: typeof profile.firstName === 'string' ? profile.firstName : '',
      lastName: typeof profile.lastName === 'string' ? profile.lastName : '',
      color: typeof profile.color === 'string' ? profile.color : '#f97316',
      imageData: typeof profile.imageData === 'string' ? profile.imageData : null,
    };
  } catch { return {}; }
};

interface ProfileState {
  firstName: string;
  lastName: string;
  color: string;
  imageData: string | null;
  update: (profile: Partial<Pick<ProfileState, 'firstName' | 'lastName' | 'color' | 'imageData'>>) => void;
  initials: () => string;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  firstName: '',
  lastName: '',
  color: '#f97316',
  imageData: null,
  ...storedProfile(),
  update: (profile) => set((state) => {
    const next = { ...state, ...profile };
    try {
      localStorage.setItem('exec_profile', JSON.stringify({
        firstName: next.firstName,
        lastName: next.lastName,
        color: next.color,
        imageData: next.imageData,
      }));
    } catch { /* storage can be unavailable */ }
    return next;
  }),
  initials: () => avatarInitials(get().firstName, get().lastName),
}));
