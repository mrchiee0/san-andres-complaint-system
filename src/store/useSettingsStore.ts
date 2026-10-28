import { create } from 'zustand';
import { safeJson } from '../lib/utils';
import { OFFICIAL_BARANGAY_ADDRESS, OFFICIAL_PIO_EMAIL } from '../constants';

interface SiteSettings {
  system_name: string;
  hero_title: string;
  hero_subtitle: string;
  about_text: string;
  footer_heading: string;
  footer_description: string;
  footer_address: string;
  footer_email: string;
  footer_phone: string;
  footer_hours: string;
  footer_text: string;
  logo_path: string;
  population: number;
  barangay_area: number;
  households: number;
}

interface SettingsState {
  settings: SiteSettings;
  isLoading: boolean;
  fetchSettings: () => Promise<void>;
}

const DEFAULT_LOGO_PATH = '/images/brgy-san-andres-logo.avif';

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: {
    system_name: 'San Andres',
    hero_title: 'Voice of the Community, <br /> <span class="text-primary">Action from the Barangay.</span>',
    hero_subtitle: 'A modern system for fast, secure, and transparent reporting of concerns in Barangay San Andres.',
    about_text: 'Designed for fast and effective public service.',
    footer_heading: 'Barangay San Andres',
    footer_description: 'Serving the community of San Andres, Cainta, Rizal with accessible and responsive public service.',
    footer_address: OFFICIAL_BARANGAY_ADDRESS,
    footer_email: OFFICIAL_PIO_EMAIL,
    footer_phone: '0917 123 4567 / 02 8654 3210',
    footer_hours: 'Monday - Friday • 8:00 AM - 5:00 PM',
    footer_text: '© 2026 Barangay San Andres. All rights reserved.',
    logo_path: DEFAULT_LOGO_PATH,
    population: 14318,
    barangay_area: 0.86,
    households: 3421,
  },
  isLoading: true,
  fetchSettings: async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await safeJson(res);
        set((state) => ({
          settings: {
            ...state.settings,
            ...data,
            logo_path: data.logo_path || state.settings.logo_path || DEFAULT_LOGO_PATH,
            footer_address: OFFICIAL_BARANGAY_ADDRESS,
            footer_email: OFFICIAL_PIO_EMAIL,
          },
          isLoading: false,
        }));
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      set({ isLoading: false });
    }
  },
}));
