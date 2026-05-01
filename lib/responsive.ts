import { Dimensions, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const BASE_WIDTH = 375;   // iPhone X/11/12/13/14 standard width
const BASE_HEIGHT = 812;  // iPhone X/11/12/13/14 standard height

// Device type flags
export const isTablet = SCREEN_WIDTH >= 768;
export const isSmallDevice = SCREEN_HEIGHT < 700; // iPhone SE and similar
export const isTallDevice = SCREEN_HEIGHT > 900;  // Pro Max, etc.

// Width ratio — capped at 1.2x for phones, 1.0x for tablets (prevent runaway scaling)
const widthRatio = isTablet
  ? Math.min(SCREEN_WIDTH / BASE_WIDTH, 1.0)
  : Math.min(SCREEN_WIDTH / BASE_WIDTH, 1.2);

// Height ratio — capped at 1.15x to avoid excessive vertical spacing on tall phones
const heightRatio = Math.min(SCREEN_HEIGHT / BASE_HEIGHT, 1.15);

// Use the smaller of width/height ratio so nothing overflows on unusual aspect ratios
const safeRatio = Math.min(widthRatio, heightRatio);

export const scaleFont = (size: number): number => Math.round(size * widthRatio);

export const scaleSize = (size: number): number => Math.round(size * widthRatio);

/** Use for vertical padding/margins so they adapt to screen HEIGHT, not width */
export const scaleVertical = (size: number): number => Math.round(size * heightRatio);

/** Constrain a value to [min, max] */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/** Max content width for iPad — keeps text/buttons in a readable column */
export const MAX_CONTENT_WIDTH = 600;

/** Spread into a container View style to center-constrain content on iPad */
export const tabletContainerStyle = isTablet
  ? ({ maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' as const, width: '100%' as const })
  : ({});

export { SCREEN_WIDTH, SCREEN_HEIGHT };

export const RESPONSIVE = {
  containerPadding: isTablet ? 48 : Math.round(SCREEN_WIDTH * 0.06),
  horizontalPadding: isTablet ? 48 : 24,

  buttonRadius: scaleSize(35),
  buttonPaddingVertical: scaleVertical(18),
  buttonPaddingHorizontal: scaleSize(32),
  buttonMinHeight: scaleVertical(56),

  titleLarge: scaleFont(32),
  titleMedium: scaleFont(28),
  titleSmall: scaleFont(24),
  subtitle: scaleFont(18),
  body: scaleFont(16),
  button: scaleFont(24),

  iconSmall: scaleSize(24),
  iconMedium: scaleSize(28),
  iconLarge: scaleSize(32),
};
