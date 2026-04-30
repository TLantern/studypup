import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingView } from '@/components/OnboardingView';
import { ACCENT_BLUE, DEEP_BLACK, SF_PRO, SUBTITLE_GRAY, sharedStyles } from '@/lib/onboarding-theme';
import { scaleSize, scaleFont } from '@/lib/responsive';
import { trackPageViewed } from '@/lib/analytics';
import { hapticContinue } from '@/lib/haptics';

const TABS = ['Minutes', 'Transcript', 'Chat'];

const SPEAKERS = [
  { id: 1, color: '#7FA8FF', initials: 'S1', time: '0:11', text: 'Good afternoon, everyone! I hope you all had a great weekend. Philip, can you get us started?' },
  { id: 2, color: '#5DC872', initials: 'S2', time: '0:31', text: 'Sounds good. From the design side, the final screens are ready. I updated the progress indicators and simplified the permissions screen.' },
  { id: 3, color: '#F5A623', initials: 'S3', time: '1:02', text: 'Great. Timeline-wise, do we still think we can ship this by Friday?' },
  { id: 1, color: '#7FA8FF', initials: 'S1', time: '1:09', text: "I'll send the links within the hour to get approved." },
];

function SpeakerBubble({ color, initials, time, text, speakerId }: { color: string; initials: string; time: string; text: string; speakerId: number }) {
  return (
    <View style={styles.bubbleRow}>
      <View style={[styles.avatar, { backgroundColor: color }]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.bubbleContent}>
        <View style={styles.bubbleMeta}>
          <Text style={styles.speakerLabel}>Speaker {speakerId}</Text>
          <Text style={styles.timestamp}>{time}</Text>
        </View>
        <Text style={styles.bubbleText}>{text}</Text>
      </View>
    </View>
  );
}

export default function FeatureTranscribeScreen() {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    trackPageViewed('ob_pro_feature_transcribe');
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
          Transcribe audio with the{' '}
          <Text style={styles.titleAccent}>latest AI models</Text>
        </Text>
        <Text style={styles.subtitle}>Word-for-word transcription, divided by speakers.</Text>

        <View style={styles.card}>
          <View style={styles.tabBar}>
            {TABS.map((tab) => (
              <View key={tab} style={[styles.tab, tab === 'Transcript' && styles.tabActive]}>
                <Text style={[styles.tabText, tab === 'Transcript' && styles.tabTextActive]}>{tab}</Text>
              </View>
            ))}
          </View>

          <ScrollView style={styles.cardScroll} contentContainerStyle={styles.cardScrollContent}>
            {SPEAKERS.map((s, i) => (
              <SpeakerBubble key={i} color={s.color} initials={s.initials} time={s.time} text={s.text} speakerId={s.id} />
            ))}
          </ScrollView>

        </View>

        <View style={styles.footer}>
          <Pressable style={styles.continueBtn} onPress={() => { hapticContinue(); router.push('/feature-chat'); }}>
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
    width: '68%',
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
  },
  cardScrollContent: {
    padding: scaleSize(14),
    gap: scaleSize(16),
  },
  bubbleRow: {
    flexDirection: 'row',
    gap: scaleSize(10),
    alignItems: 'flex-start',
  },
  avatar: {
    width: scaleSize(30),
    height: scaleSize(30),
    borderRadius: scaleSize(15),
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(11),
    fontWeight: '700',
    color: '#fff',
  },
  bubbleContent: {
    flex: 1,
  },
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(6),
    marginBottom: scaleSize(3),
  },
  speakerLabel: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(12),
    fontWeight: '700',
    color: DEEP_BLACK,
  },
  timestamp: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(11),
    color: SUBTITLE_GRAY,
  },
  bubbleText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(12),
    color: '#444',
    lineHeight: scaleFont(18),
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
