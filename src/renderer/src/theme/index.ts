import { createTheme, type MantineColorsTuple } from '@mantine/core';

const ember: MantineColorsTuple = [
  '#fff3e8', '#ffe0c7', '#ffc296', '#ffa05f', '#ff8636',
  '#ff6f1a', '#f05f0b', '#c74c06', '#9d3b04', '#6c2a03',
];

// Mantine dark scale: 0 = lightest text ... 9 = deepest background.
const dark: MantineColorsTuple = [
  '#c9cbd3', '#aeb1bc', '#8d91a0', '#6b6f7e', '#3a3d49',
  '#2a2c36', '#1d1f27', '#16171d', '#0f1014', '#0a0b0e',
];

const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';

/** Modals rise 6px and scale from 0.97; never from nothing. */
const modalTransition = {
  in: { opacity: 1, transform: 'scale(1) translateY(0)' },
  out: { opacity: 0, transform: 'scale(0.97) translateY(6px)' },
  common: { transformOrigin: 'center' },
  transitionProperty: 'transform, opacity',
};

// Windows ships Segoe UI Variable on 11 and Segoe UI on 10; both fall back cleanly.
const SANS = '"Segoe UI Variable Text", "Segoe UI", Inter, system-ui, -apple-system, sans-serif';
const DISPLAY = '"Segoe UI Variable Display", "Segoe UI", Inter, system-ui, sans-serif';

export const theme = createTheme({
  primaryColor: 'ember',
  primaryShade: { light: 6, dark: 5 },
  colors: { ember, dark },
  fontFamily: SANS,
  headings: { fontFamily: DISPLAY, fontWeight: '700' },
  defaultRadius: 'md',
  cursorType: 'pointer',
  respectReducedMotion: true,
  components: {
    Modal: {
      defaultProps: {
        radius: 'lg',
        centered: true,
        overlayProps: { backgroundOpacity: 0.55, blur: 4 },
        transitionProps: { transition: modalTransition, duration: 200, timingFunction: EASE },
      },
    },
    Menu: { defaultProps: { transitionProps: { transition: 'pop-top-left', duration: 140, timingFunction: EASE } } },
    Popover: { defaultProps: { transitionProps: { transition: 'pop', duration: 140, timingFunction: EASE } } },
    Combobox: { defaultProps: { transitionProps: { transition: 'pop', duration: 120, timingFunction: EASE } } },
    Tooltip: { defaultProps: { transitionProps: { transition: 'fade', duration: 120 } } },
    Button: { styles: { root: { fontWeight: 600 } } },
  },
});
