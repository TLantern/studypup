import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingView } from '@/components/OnboardingView';
import { ACCENT_BLUE, DEEP_BLACK, SF_PRO, SUBTITLE_GRAY, OFF_WHITE, CARD_SHADOW, sharedStyles } from '@/lib/onboarding-theme';
import { scaleSize, scaleFont } from '@/lib/responsive';
import { trackPageViewed } from '@/lib/analytics';
import { hapticContinue } from '@/lib/haptics';

export default function MeetingReviewScreen() {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    trackPageViewed('ob_pro_meeting_review');
  }, []);

  return (
    <OnboardingView>
      <View style={[styles.container, { paddingTop: insets.top + scaleSize(24), paddingBottom: insets.bottom + scaleSize(24) }]}>
        <View style={styles.progressRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color={DEEP_BLACK} />
          </Pressable>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
        </View>

        <Text style={styles.title}>You're in the right place.</Text>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.reviewerRole}>Great app</Text>
            <View style={styles.reviewMeta}>
              <Text style={styles.reviewAuthor}>G Kipling</Text>
              <Text style={styles.reviewDate}>1 month ago</Text>
            </View>
          </View>
          <Text style={styles.reviewText}>
            It's a really good app and has accurate responses unlike some other apps. 100% recommend subscribing!!
          </Text>
          <Text style={styles.stars}>★★★★★</Text>
        </View>

        <View style={styles.footer}>
          <Pressable style={styles.continueBtn} onPress={() => { hapticContinue(); router.push('/notario-intro'); }}>
            <Text style={styles.continueBtnText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </OnboardingView>
  );
}

const styles = StyleSheet.create({
  container: sharedStyles.container,
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleSize(36),
    gap: scaleSize(8),
  },
  backBtn: { padding: scaleSize(4) },
  progressTrack: {
    flex: 1,
    height: 10,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 6,
  },
  progressFill: {
    height: '100%',
    width: '25%',
    backgroundColor: ACCENT_BLUE,
    borderRadius: 6,
  },
  subtitle: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    color: SUBTITLE_GRAY,
    marginBottom: scaleSize(8),
  },
  title: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(28),
    fontWeight: '700',
    color: DEEP_BLACK,
    letterSpacing: -0.5,
    marginBottom: scaleSize(32),
  },
  card: {
    backgroundColor: OFF_WHITE,
    borderRadius: scaleSize(16),
    padding: scaleSize(24),
    ...CARD_SHADOW,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: scaleSize(12),
  },
  reviewMeta: {
    alignItems: 'flex-end',
  },
  reviewAuthor: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(13),
    fontWeight: '600',
    color: DEEP_BLACK,
  },
  reviewDate: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(12),
    color: SUBTITLE_GRAY,
  },
  reviewerRole: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    fontWeight: '700',
    color: DEEP_BLACK,
  },
  reviewText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(16),
    color: DEEP_BLACK,
    lineHeight: scaleFont(24),
    marginBottom: scaleSize(16),
  },
  stars: {
    fontSize: scaleFont(26),
    color: '#F5A623',
    letterSpacing: 2,
  },
  footer: {
    marginTop: 'auto',
  },
  continueBtn: sharedStyles.continueBtn,
  continueBtnText: sharedStyles.continueBtnText,
});
