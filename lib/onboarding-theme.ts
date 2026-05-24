import { Platform } from 'react-native';
import { scaleSize, scaleFont, scaleVertical } from '@/lib/responsive';

// Notario palette — see /references/color-palette.json
export const DEEP_BLACK = '#0D0D0F';
export const GRAPHITE_GRAY = '#1E1E22';
export const OFF_WHITE = '#F7F7F5';
export const METALLIC_SILVER = '#C9CCD1';
export const ACCENT_BLUE = '#7FA8FF'; // DEEP_PASTEL_BLUE — primary accent
export const ACCENT_BLUE_PRESSED = '#6A95EE';
export const ACCENT_BLUE_TINT = '#EEF3FF';
export const MUTED_EMERALD = '#5F76AE';
export const SUBTITLE_GRAY = '#6B7280';
export const MUTED_TEXT = 'rgba(0,0,0,0.4)';
export const HAIRLINE = 'rgba(0,0,0,0.08)';
// Semantic mastery colors (kept distinct since they convey state, not brand)
export const MASTERY_LOW = '#E07070';
export const MASTERY_MID = '#E8C547';
export const MASTERY_HIGH = ACCENT_BLUE;
export const MASTERY_DONE = '#5BB071';

export const SF_PRO = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

export const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.14,
  shadowRadius: 0,
  elevation: 5,
};

export const SCREEN_PADDING = scaleSize(24);

export const sharedStyles = {
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SCREEN_PADDING,
  },
  progressTrack: {
    height: 10,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 6,
    marginBottom: scaleSize(36),
  },
  title: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(22),
    fontWeight: '700' as const,
    color: DEEP_BLACK,
    letterSpacing: -0.5,
    marginBottom: scaleSize(4),
    textAlign: 'center' as const,
  },
  subtitle: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(13),
    color: SUBTITLE_GRAY,
    fontWeight: '400' as const,
    marginBottom: scaleSize(28),
    textAlign: 'center' as const,
  },
  card: {
    backgroundColor: OFF_WHITE,
    borderRadius: scaleSize(8),
    paddingVertical: scaleSize(18),
    paddingHorizontal: scaleSize(20),
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...CARD_SHADOW,
  },
  cardSelected: {
    borderColor: ACCENT_BLUE,
    backgroundColor: '#EEF3FF',
  },
  cardPressed: {
    opacity: 0.75,
  },
  cardText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(16),
    fontWeight: '600' as const,
    color: DEEP_BLACK,
  },
  cardTextSelected: {
    color: ACCENT_BLUE,
  },
  continueBtn: {
    backgroundColor: ACCENT_BLUE,
    borderRadius: scaleSize(16),
    paddingVertical: scaleVertical(18),
    alignItems: 'center' as const,
    ...CARD_SHADOW,
  },
  continueBtnDisabled: {
    opacity: 0.45,
  },
  continueBtnText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(17),
    fontWeight: '600' as const,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  eyebrow: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    color: ACCENT_BLUE,
    fontWeight: '400' as const,
    marginBottom: scaleSize(2),
    textAlign: 'left' as const,
  },
  skipText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    color: SUBTITLE_GRAY,
    textAlign: 'center' as const,
    marginBottom: scaleSize(12),
  },
};
