import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

export const PENDING_MEETING_KEY = '@studypup/pending_meeting_transcript';
import { Ionicons } from '@expo/vector-icons';
import {
  DEEP_BLACK,
  OFF_WHITE,
  ACCENT_BLUE,
  SUBTITLE_GRAY,
  SF_PRO,
} from '@/lib/onboarding-theme';
import { useAuth } from '@/lib/auth-store';
import {
  useMeetingSession,
  assembleTranscript,
  SPEAKER_COLORS,
} from '@/lib/useMeetingSession';

export default function CaptureMeetingScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const {
    sessionId,
    status,
    chunks,
    createSession,
    startListening,
    endSession,
  } = useMeetingSession(user?.uid ?? 'anonymous');

  const [isCreating, setIsCreating] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  // ── AppState monitoring — detect backgrounding which kills WS/Firebase ──────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      console.log('[capture-meeting] AppState changed →', nextState, '— chunks so far:', chunks.length);
      if (nextState === 'background' || nextState === 'inactive') {
        console.warn('[capture-meeting] ⚠️  App moved to background — WS and Firebase listener may pause');
      } else if (nextState === 'active') {
        console.log('[capture-meeting] App returned to foreground');
      }
    });
    return () => sub.remove();
  }, [chunks.length]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setIsCreating(true);
      console.log('[capture-meeting] Initialising session…');
      try {
        const id = await createSession();
        console.log('[capture-meeting] Session created:', id.slice(0, 8).toUpperCase());
        if (!cancelled) startListening(id);
      } catch (e: any) {
        console.error('[capture-meeting] ❌ Session creation failed:', e?.message);
        if (!cancelled) {
          Alert.alert('Error', 'Could not create meeting session. Check your connection.');
        }
      } finally {
        if (!cancelled) setIsCreating(false);
      }
    };
    init();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (chunks.length > 0) {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }, [chunks.length]);

  const handleEndMeeting = () => {
    if (isEnding) return;
    if (chunks.length === 0) {
      Alert.alert(
        'No transcript yet',
        'No spoken content was captured. End meeting anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'End anyway', style: 'destructive', onPress: doEndMeeting },
        ],
      );
      return;
    }
    doEndMeeting();
  };

  const doEndMeeting = async () => {
    setIsEnding(true);
    console.log(`[capture-meeting] Ending meeting — ${chunks.length} chunk(s) collected`);
    try {
      await endSession();
      const transcript = assembleTranscript(chunks);
      const dateStr = new Date().toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
      await AsyncStorage.setItem(PENDING_MEETING_KEY, JSON.stringify({
        transcript,
        name: `Meeting — ${dateStr}`,
      }));
      router.replace('/professional-home');
    } catch (e: any) {
      console.error('[capture-meeting] ❌ End meeting failed:', e?.message);
      Alert.alert('Error', 'Could not save transcript. Please try again.');
      setIsEnding(false);
    }
  };

  const handleShareCode = async () => {
    if (!sessionId) return;
    const displayCode = sessionId.slice(0, 8).toUpperCase();
    await Share.share({
      message: `Notario meeting session code: ${displayCode}\n\nOpen the Notario Chrome extension on your Google Meet tab and enter this code.`,
    });
  };

  const displayCode = sessionId ? sessionId.slice(0, 8).toUpperCase() : '--------';

  const statusLabel: Record<string, string> = {
    idle: 'Initializing…',
    waiting: 'Waiting for Chrome extension',
    active: 'Recording',
    ended: 'Ended',
    error: 'Error',
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={DEEP_BLACK} />
        </Pressable>
        <Text style={styles.title}>Capture Meeting</Text>
        <View style={{ width: 40 }} />
      </View>

      {isCreating ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={ACCENT_BLUE} />
          <Text style={styles.loadingText}>Creating session…</Text>
        </View>
      ) : (
        <>
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Session Code</Text>
            <Text style={styles.codeValue}>{displayCode}</Text>
            <Text style={styles.codeHint}>
              Open the Notario extension on your Google Meet tab and enter this code.
            </Text>
            <Pressable style={styles.shareBtn} onPress={handleShareCode}>
              <Ionicons name="share-outline" size={18} color={ACCENT_BLUE} />
              <Text style={styles.shareBtnText}>Share Code</Text>
            </Pressable>
          </View>

          <View style={[styles.statusPill, status === 'active' && styles.statusPillActive]}>
            {status === 'active' && <View style={styles.recordDot} />}
            <Text style={[styles.statusText, status === 'active' && styles.statusTextActive]}>
              {statusLabel[status] ?? status}
            </Text>
          </View>

          {chunks.length > 0 && (
            <Text style={styles.connectedLabel}>Connected</Text>
          )}
          <View style={[styles.transcriptBorder, chunks.length > 0 && styles.transcriptBorderActive]}>
          <ScrollView
            ref={scrollRef}
            style={styles.transcriptScroll}
            contentContainerStyle={styles.transcriptContent}
            showsVerticalScrollIndicator={false}
          >
            {chunks.length === 0 && status === 'waiting' && (
              <Text style={styles.emptyTranscript}>
                Transcript will appear here once the extension starts capturing audio.
              </Text>
            )}
            {chunks.map((chunk) => {
              const speakerIndex = parseInt(chunk.speaker, 10) % SPEAKER_COLORS.length;
              const color = SPEAKER_COLORS[speakerIndex];
              return (
                <View key={chunk.id} style={styles.chunkRow}>
                  <View style={[styles.speakerDot, { backgroundColor: color }]} />
                  <View style={styles.chunkTextWrap}>
                    <Text style={[styles.speakerLabel, { color }]}>
                      Speaker {parseInt(chunk.speaker, 10) + 1}
                    </Text>
                    <Text style={styles.chunkText}>{chunk.text}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
          </View>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <Pressable
              style={[styles.endBtn, isEnding && styles.endBtnDisabled]}
              onPress={handleEndMeeting}
              disabled={isEnding}
            >
              {isEnding
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.endBtnText}>End Meeting & Generate Notes</Text>
              }
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: OFF_WHITE },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  backBtn: { padding: 4 },
  title: {
    flex: 1, textAlign: 'center',
    fontFamily: SF_PRO, fontSize: 18,
    fontWeight: '600', color: DEEP_BLACK,
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontFamily: SF_PRO, fontSize: 16, color: SUBTITLE_GRAY },
  codeCard: {
    margin: 20, padding: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: ACCENT_BLUE,
    alignItems: 'center',
    gap: 8,
  },
  codeLabel: {
    fontFamily: SF_PRO, fontSize: 13, color: SUBTITLE_GRAY,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  codeValue: {
    fontFamily: SF_PRO, fontSize: 36, fontWeight: '700',
    color: DEEP_BLACK, letterSpacing: 6,
  },
  codeHint: {
    fontFamily: SF_PRO, fontSize: 14, color: SUBTITLE_GRAY,
    textAlign: 'center', lineHeight: 20,
  },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  shareBtnText: { fontFamily: SF_PRO, fontSize: 15, color: ACCENT_BLUE },
  statusPill: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'center', gap: 8,
    paddingVertical: 6, paddingHorizontal: 16,
    backgroundColor: '#E8E8E8', borderRadius: 20, marginBottom: 12,
  },
  statusPillActive: { backgroundColor: '#FEE2E2' },
  recordDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  statusText: { fontFamily: SF_PRO, fontSize: 13, color: SUBTITLE_GRAY },
  statusTextActive: { color: '#EF4444', fontWeight: '600' },
  connectedLabel: {
    fontFamily: SF_PRO, fontSize: 12, fontWeight: '600',
    color: '#22C55E', textTransform: 'uppercase', letterSpacing: 1,
    alignSelf: 'flex-start', marginHorizontal: 20, marginBottom: 4,
  },
  transcriptBorder: {
    flex: 1, marginHorizontal: 20, borderRadius: 16,
    borderWidth: 1.5, borderColor: 'transparent',
    overflow: 'hidden',
  },
  transcriptBorderActive: { borderColor: '#22C55E' },
  transcriptScroll: { flex: 1, paddingHorizontal: 12 },
  transcriptContent: { paddingBottom: 24, gap: 12 },
  emptyTranscript: {
    fontFamily: SF_PRO, fontSize: 15, color: SUBTITLE_GRAY,
    textAlign: 'center', marginTop: 40, lineHeight: 22,
  },
  chunkRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  speakerDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  chunkTextWrap: { flex: 1 },
  speakerLabel: {
    fontFamily: SF_PRO, fontSize: 11, fontWeight: '600',
    marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  chunkText: { fontFamily: SF_PRO, fontSize: 15, color: DEEP_BLACK, lineHeight: 22 },
  footer: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: OFF_WHITE },
  endBtn: {
    backgroundColor: DEEP_BLACK,
    borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', minHeight: 56,
  },
  endBtnDisabled: { opacity: 0.5 },
  endBtnText: { fontFamily: SF_PRO, fontSize: 17, fontWeight: '600', color: '#fff' },
});
