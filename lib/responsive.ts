import { Dimensions } from 'react-native';

// Get screen dimensions for responsive sizing
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const BASE_WIDTH = 375;
const MIN_RATIO = 0.85;
const MAX_RATIO = 1.25;

const scaleRatio = Math.min(MAX_RATIO, Math.max(MIN_RATIO, SCREEN_WIDTH / BASE_WIDTH));

export const scaleFont = (size: number): number => Math.round(size * scaleRatio);
export const scaleSize = (size: number): number => Math.round(size * scaleRatio);

// Screen dimensions
export { SCREEN_WIDTH, SCREEN_HEIGHT };

// Common responsive values
export const RESPONSIVE = {
  // Padding
  containerPadding: SCREEN_WIDTH * 0.06,
  horizontalPadding: scaleSize(24),
  
  // Button dimensions
  buttonRadius: scaleSize(35),
  buttonPaddingVertical: scaleSize(18),
  buttonPaddingHorizontal: scaleSize(32),
  buttonMinHeight: scaleSize(56),
  
  // Common font sizes
  titleLarge: scaleFont(32),
  titleMedium: scaleFont(28),
  titleSmall: scaleFont(24),
  subtitle: scaleFont(18),
  body: scaleFont(16),
  button: scaleFont(24),
  
  // Icon sizes
  iconSmall: scaleSize(24),
  iconMedium: scaleSize(28),
  iconLarge: scaleSize(32),
};