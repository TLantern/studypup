import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingView } from '@/components/OnboardingView';
import { ACCENT_BLUE, DEEP_BLACK, SF_PRO, SUBTITLE_GRAY, OFF_WHITE, sharedStyles } from '@/lib/onboarding-theme';
import { scaleSize, scaleFont } from '@/lib/responsive';
import { trackPageViewed } from '@/lib/analytics';
import { hapticContinue } from '@/lib/haptics';

const TABS = ['Notario', 'Transcript', 'Chat'];

function Section({ title, bullets }: { title: string; bullets: string[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {bullets.map((b, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{b}</Text>
        </View>
      ))}
    </View>
  );
}

export default function FeatureNotesScreen() {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    trackPageViewed('ob_pro_feature_notes');
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

        <Text style={styles.title}>
          <Text style={styles.titleAccent}>Perfect notes{'\n'}</Text>
          generated instantly
        </Text>
        <Text style={styles.subtitle}>Summaries, action items, and key decisions, all in one place.</Text>

        <View style={styles.card}>
          <View style={styles.tabBar}>
            {TABS.map((tab) => (
              <View key={tab} style={[styles.tab, tab === 'Notario' && styles.tabActive]}>
                <Text style={[styles.tabText, tab === 'Notario' && styles.tabTextActive]}>{tab}</Text>
              </View>
            ))}
          </View>

          <ScrollView style={styles.cardScroll}>
            <Section
              title="Current Financial Performance"
              bullets={[
                'Reviewed Q4 financial statements and year-to-date performance.',
                'Revenue increased 6% year-over-year but operating margins declined from 18% → 14%.',
                'Action: Emily to prepare a detailed cost breakdown by department before next meeting.',
              ]}
            />
            <Section
              title="Growth Strategy Discussion"
              bullets={[
                'Discussed potential expansion into enterprise clients to increase average contract value.',
                'Identified opportunity to introduce tiered pricing structure for premium customers.',
              ]}
            />
            <Section
              title="Next Steps & Deliverables"
              bullets={[
                'Consulting team to deliver financial model with 3 growth scenarios.',
              ]}
            />
          </ScrollView>

        </View>

        <View style={styles.footer}>
          <Pressable style={styles.continueBtn} onPress={() => { hapticContinue(); router.push('/feature-transcribe'); }}>
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
    marginBottom: scaleSize(32),
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
    width: '57%',
    backgroundColor: ACCENT_BLUE,
    borderRadius: 6,
  },
  title: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(30),
    fontWeight: '800',
    color: DEEP_BLACK,
    letterSpacing: -0.8,
    lineHeight: scaleFont(38),
    marginBottom: scaleSize(10),
  },
  titleAccent: {
    color: ACCENT_BLUE,
  },
  subtitle: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    color: SUBTITLE_GRAY,
    lineHeight: scaleFont(22),
    marginBottom: scaleSize(20),
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: scaleSize(16),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: scaleSize(12),
    paddingTop: scaleSize(12),
    paddingBottom: scaleSize(8),
    gap: scaleSize(6),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  tab: {
    paddingVertical: scaleSize(5),
    paddingHorizontal: scaleSize(12),
    borderRadius: scaleSize(20),
    backgroundColor: 'transparent',
  },
  tabActive: {
    backgroundColor: ACCENT_BLUE,
  },
  tabText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(13),
    fontWeight: '500',
    color: SUBTITLE_GRAY,
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  cardScroll: {
    flex: 1,
    paddingHorizontal: scaleSize(16),
    paddingTop: scaleSize(12),
  },
  section: {
    marginBottom: scaleSize(14),
  },
  sectionTitle: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(13),
    fontWeight: '700',
    color: DEEP_BLACK,
    marginBottom: scaleSize(6),
  },
  bulletRow: {
    flexDirection: 'row',
    gap: scaleSize(6),
    marginBottom: scaleSize(4),
  },
  bulletDot: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(12),
    color: SUBTITLE_GRAY,
    lineHeight: scaleFont(18),
  },
  bulletText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(12),
    color: '#444',
    lineHeight: scaleFont(18),
    flex: 1,
  },
  fadeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: scaleSize(48),
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  footer: {
    marginTop: scaleSize(16),
  },
  continueBtn: sharedStyles.continueBtn,
  continueBtnText: sharedStyles.continueBtnText,
});
