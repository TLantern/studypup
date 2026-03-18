import { Dimensions } from 'react-native';

// Get screen dimensions for responsive sizing
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base width for scaling calculations (iPhone X)
const BASE_WIDTH = 375;

// Responsive scaling functions
export const scaleFont = (size: number): number => {
  const ratio = SCREEN_WIDTH / BASE_WIDTH;
  return Math.round(size * ratio);
};

export const scaleSize = (size: number): number => {
  const ratio = SCREEN_WIDTH / BASE_WIDTH;
  return Math.round(size * ratio);
};

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