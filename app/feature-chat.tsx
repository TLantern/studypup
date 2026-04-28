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

const TABS = ['Notario', 'Transcript', 'Chat'];

export default function FeatureChatScreen() {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    trackPageViewed('ob_pro_feature_chat');
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
          Extract{' '}
          <Text style={styles.titleAccent}>insights</Text>
          {' '}and{'\n'}
          <Text style={styles.titleAccent}>action-items</Text>
          {' '}directly{'\n'}
          from notes
        </Text>
        <Text style={styles.subtitle}>Ask questions, format transcript,{'\n'}an all-in-one powerhouse</Text>

        <View style={styles.card}>
          <View style={styles.tabBar}>
            {TABS.map((tab) => (
              <View key={tab} style={[styles.tab, tab === 'Chat' && styles.tabActive]}>
                <Text style={[styles.tabText, tab === 'Chat' && styles.tabTextActive]}>{tab}</Text>
              </View>
            ))}
          </View>

          <ScrollView style={styles.cardScroll} contentContainerStyle={styles.chatContent}>
            {/* AI greeting */}
            <View style={styles.messageRow}>
              <View style={styles.aiDot} />
              <View style={styles.messageBubble}>
                <Text style={styles.messageText}>
                  Hi! I'm here to help you with your note: <Text style={styles.messageBold}>Sales Strategy for Acme Corp.</Text> How can I help?
                </Text>
              </View>
            </View>

            {/* User chip */}
            <View style={styles.chipRow}>
              <View style={styles.chip}>
                <Text style={styles.chipText}>List of action items</Text>
              </View>
            </View>

            {/* AI response */}
            <View style={styles.messageRow}>
              <View style={styles.aiDot} />
              <View style={styles.messageBubble}>
                <Text style={styles.messageText}>
                  Okay, here are the action items I've identified from the transcript:
                </Text>
                <View style={styles.actionList}>
                  <Text style={styles.actionPerson}>1. Michael Lee</Text>
                  <Text style={styles.actionItem}>• Review updated deal forecast for Acme Corp and confirm target close date for Q2.</Text>
                  <Text style={styles.actionItem}>• Coordinate with finance to approve discount range for enterprise contract.</Text>
                  <Text style={styles.actionItem}>• Schedule executive check-in with Acme Corp leadership to strengthen relationship before final decision.</Text>
                  <Text style={styles.actionPerson}>2. Priya Patel</Text>
                  <Text style={styles.actionItem}>• Send follow-up email summarizing product capabilities and pricing tiers discussed in the meeting.</Text>
                  <Text style={styles.actionItem}>• Confirm procurement timeline and next steps with Acme Corp's legal team.</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>

        <View style={styles.footer}>
          <Pressable style={styles.continueBtn} onPress={() => { hapticContinue(); router.push('/privacy-trust'); }}>
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
    marginBottom: scaleSize(28),
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
    width: '92%',
    backgroundColor: ACCENT_BLUE,
    borderRadius: 6,
  },
  title: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(28),
    fontWeight: '800',
    color: DEEP_BLACK,
    letterSpacing: -0.8,
    lineHeight: scaleFont(36),
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
    marginBottom: scaleSize(18),
    textAlign: 'center',
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
  chatContent: {
    padding: scaleSize(14),
    gap: scaleSize(14),
  },
  messageRow: {
    flexDirection: 'row',
    gap: scaleSize(8),
    alignItems: 'flex-start',
  },
  aiDot: {
    width: scaleSize(24),
    height: scaleSize(24),
    borderRadius: scaleSize(12),
    backgroundColor: ACCENT_BLUE,
    flexShrink: 0,
    marginTop: scaleSize(2),
  },
  messageBubble: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: scaleSize(10),
    padding: scaleSize(10),
  },
  messageText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(12),
    color: '#333',
    lineHeight: scaleFont(18),
  },
  messageBold: {
    fontWeight: '700',
    color: DEEP_BLACK,
  },
  chipRow: {
    paddingLeft: scaleSize(32),
  },
  chip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    borderRadius: scaleSize(20),
    paddingVertical: scaleSize(6),
    paddingHorizontal: scaleSize(14),
  },
  chipText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(12),
    color: DEEP_BLACK,
    fontWeight: '500',
  },
  actionList: {
    marginTop: scaleSize(8),
    gap: scaleSize(3),
  },
  actionPerson: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(12),
    fontWeight: '700',
    color: DEEP_BLACK,
    marginTop: scaleSize(4),
    marginBottom: scaleSize(2),
  },
  actionItem: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(12),
    color: '#444',
    lineHeight: scaleFont(18),
    paddingLeft: scaleSize(8),
  },
  footer: {
    marginTop: scaleSize(16),
  },
  continueBtn: sharedStyles.continueBtn,
  continueBtnText: sharedStyles.continueBtnText,
});
