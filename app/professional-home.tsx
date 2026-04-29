import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Clipboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { trackPageViewed } from '@/lib/analytics';
import { hapticSelect } from '@/lib/haptics';
import { scaleFont, scaleSize } from '@/lib/responsive';

const BG = '#F2F2F4';
const CARD = '#FFFFFF';
const DEEP_BLACK = '#0D0D0F';
const SUBTITLE_GRAY = '#6B7280';
const PILL_GRAY = '#FFFFFF';
const ACCENT_BLUE = '#3B82F6';
const SF_PRO = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

type FilterTab = 'all' | 'folders';

const FILTERS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All Notes' },
  { id: 'folders', label: 'Folders' },
];

const NEW_NOTE_OPTIONS = [
  { id: 'record', label: 'New record', emoji: '🎙️', bg: '#FBD3D8' },
  { id: 'youtube', label: 'YouTube Video', emoji: '▶️', bg: '#FBE0B5' },
  { id: 'voice', label: 'Upload voice memo', emoji: '🎵', bg: '#BBD4FB' },
] as const;

const SAMPLE_NOTES = [
  {
    id: 'welcome',
    title: 'Welcome to the App!',
    subtitle: 'Discover all features today',
    unread: true,
  },
];

export default function ProfessionalHomeScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [showNewNote, setShowNewNote] = useState(false);

  // YouTube sheet
  const [showYouTube, setShowYouTube] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');

  // Recording
  const [showRecord, setShowRecord] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingMetering, setRecordingMetering] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const recordSlide = useSharedValue(1);
  const recordAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: recordSlide.value * 600 }],
  }));

  useEffect(() => {
    trackPageViewed('professional_home');
  }, []);

  // ─── Recording helpers ───────────────────────────────────────────────────
  const openRecord = useCallback(async () => {
    setShowRecord(true);
    recordSlide.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) });
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      setRecordingDuration(0);
      setIsPaused(false);
      setRecordingMetering(null);
      activateKeepAwakeAsync();
      rec.setOnRecordingStatusUpdate((s) => {
        if (s.metering != null) setRecordingMetering(s.metering);
      });
      rec.setProgressUpdateInterval(100);
      timerRef.current = setInterval(() => setRecordingDuration((p) => p + 1), 1000);
    } catch (e) {
      console.error('startRecording failed', e);
    }
  }, []);

  const pauseRecording = useCallback(async () => {
    if (!recording || isPaused) return;
    await recording.pauseAsync();
    setIsPaused(true);
    setRecordingMetering(null);
    if (timerRef.current) clearInterval(timerRef.current);
    deactivateKeepAwake();
  }, [recording, isPaused]);

  const resumeRecording = useCallback(async () => {
    if (!recording || !isPaused) return;
    await recording.startAsync();
    setIsPaused(false);
    activateKeepAwakeAsync();
    timerRef.current = setInterval(() => setRecordingDuration((p) => p + 1), 1000);
  }, [recording, isPaused]);

  const cancelRecord = useCallback(() => {
    if (recording) {
      recording.stopAndUnloadAsync();
      setRecording(null);
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsPaused(false);
    setRecordingDuration(0);
    setRecordingMetering(null);
    deactivateKeepAwake();
    recordSlide.value = withTiming(1, { duration: 300, easing: Easing.in(Easing.cubic) }, () =>
      runOnJS(setShowRecord)(false)
    );
  }, [recording]);

  const stopAndSave = useCallback(async () => {
    if (!recording) return;
    if (timerRef.current) clearInterval(timerRef.current);
    deactivateKeepAwake();
    await recording.stopAndUnloadAsync();
    setRecording(null);
    setIsPaused(false);
    setRecordingDuration(0);
    setRecordingMetering(null);
    recordSlide.value = withTiming(1, { duration: 300, easing: Easing.in(Easing.cubic) }, () =>
      runOnJS(setShowRecord)(false)
    );
  }, [recording]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // ─── Handlers ───────────────────────────────────────────────────────────
  const handleNewNoteOption = (id: string) => {
    hapticSelect();
    setShowNewNote(false);
    if (id === 'record') {
      setTimeout(openRecord, 300);
    } else if (id === 'youtube') {
      setYoutubeUrl('');
      setTimeout(() => setShowYouTube(true), 300);
    } else if (id === 'voice') {
      setTimeout(pickAudio, 300);
    }
  };

  const pickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', 'public.audio'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];
      Alert.alert('Voice memo selected', file.name ?? 'audio file');
    } catch (e) {
      console.error('Audio picker failed', e);
    }
  };

  const handleYouTubeSubmit = () => {
    if (!youtubeUrl.trim()) return;
    setShowYouTube(false);
    // process URL — hook into existing youtube-transcript flow when ready
  };

  // ─── Content ─────────────────────────────────────────────────────────────
  const renderContent = () => {
    if (filter === 'folders') {
      return (
        <View style={styles.emptyWrap}>
          <Text style={styles.folderEmoji}>📁</Text>
          <Text style={styles.emptyTitle}>Create Your First Folder</Text>
          <Text style={styles.emptySubtitle}>
            Organize notes into folders{'\n'}for easy access
          </Text>
          <Pressable
            style={({ pressed }) => [styles.emptyCta, pressed && { opacity: 0.85 }]}
            onPress={() => hapticSelect()}
          >
            <Text style={styles.emptyCtaText}>Create Folder</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={{ paddingHorizontal: scaleSize(20), paddingTop: scaleSize(8) }}>
        <Text style={styles.sectionLabel}>Today</Text>
        {SAMPLE_NOTES.map((note) => (
          <Pressable
            key={note.id}
            style={({ pressed }) => [styles.noteCard, pressed && { opacity: 0.85 }]}
            onPress={() => {
              hapticSelect();
              router.push({
                pathname: '/professional-note-detail',
                params: { id: note.id, title: note.title, subtitle: note.subtitle },
              });
            }}
          >
            <View style={styles.noteIconWrap}>
              <Text style={{ fontSize: scaleFont(20) }}>⭐</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.noteTitle}>{note.title}</Text>
              <Text style={styles.noteSubtitle}>{note.subtitle}</Text>
            </View>
            {note.unread && <View style={styles.unreadDot} />}
            <Ionicons name="chevron-forward" size={18} color={DEEP_BLACK} />
          </Pressable>
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }} />
        <Pressable hitSlop={12} onPress={() => hapticSelect()}>
          <Ionicons name="settings-outline" size={26} color={DEEP_BLACK} />
        </Pressable>
      </View>

      <Text style={styles.pageTitle}>My Notes</Text>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={SUBTITLE_GRAY} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Find note"
          placeholderTextColor={SUBTITLE_GRAY}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.filtersRow}>
        {FILTERS.map((f) => {
          const selected = filter === f.id;
          return (
            <Pressable
              key={f.id}
              style={[styles.filterPill, selected && styles.filterPillSelected]}
              onPress={() => { hapticSelect(); setFilter(f.id); }}
            >
              <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: scaleSize(140) }}
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}
      </ScrollView>

      <View style={[styles.fabWrap, { paddingBottom: insets.bottom + scaleSize(20) }]}>
        <Pressable
          style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9 }]}
          onPress={() => { hapticSelect(); setShowNewNote(true); }}
        >
          <Text style={styles.fabText}>New Note</Text>
        </Pressable>
      </View>

      {/* ── New Note sheet ── */}
      <Modal visible={showNewNote} transparent animationType="slide" onRequestClose={() => setShowNewNote(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowNewNote(false)}>
          <Pressable
            style={[styles.sheet, { paddingBottom: insets.bottom + scaleSize(20) }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>New note</Text>
              <Pressable style={styles.sheetClose} hitSlop={12} onPress={() => setShowNewNote(false)}>
                <Text style={{ fontSize: scaleFont(16), color: DEEP_BLACK }}>✕</Text>
              </Pressable>
            </View>

            {NEW_NOTE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.id}
                style={({ pressed }) => [styles.sheetOption, pressed && { opacity: 0.85 }]}
                onPress={() => handleNewNoteOption(opt.id)}
              >
                <View style={[styles.sheetIconCircle, { backgroundColor: opt.bg }]}>
                  <Text style={{ fontSize: scaleFont(18) }}>{opt.emoji}</Text>
                </View>
                <Text style={styles.sheetOptionText}>{opt.label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── YouTube note sheet ── */}
      <Modal visible={showYouTube} transparent animationType="slide" onRequestClose={() => setShowYouTube(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowYouTube(false)}>
          <Pressable
            style={[styles.sheet, { paddingBottom: insets.bottom + scaleSize(24) }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>YouTube note</Text>
              <Pressable style={styles.sheetClose} hitSlop={12} onPress={() => setShowYouTube(false)}>
                <Text style={{ fontSize: scaleFont(16), color: DEEP_BLACK }}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.ytInputRow}>
              <TextInput
                value={youtubeUrl}
                onChangeText={setYoutubeUrl}
                placeholder="Place link here"
                placeholderTextColor={SUBTITLE_GRAY}
                style={styles.ytInput}
                autoCapitalize="none"
                keyboardType="url"
              />
              <Pressable
                style={styles.ytPasteBtn}
                onPress={async () => {
                  const text = await Clipboard.getString();
                  setYoutubeUrl(text);
                }}
              >
                <Text style={{ fontSize: scaleFont(14) }}>📋</Text>
                <Text style={styles.ytPasteText}>Tap to paste</Text>
              </Pressable>
            </View>

            <View style={styles.ytHintRow}>
              <Ionicons name="information-circle-outline" size={14} color={SUBTITLE_GRAY} />
              <Text style={styles.ytHint}>Unlisted videos aren't supported</Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.ytSubmit, pressed && { opacity: 0.85 }]}
              onPress={handleYouTubeSubmit}
            >
              <Text style={styles.ytSubmitText}>Submit</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Recording screen ── */}
      {showRecord && (
        <Animated.View style={[styles.recordScreen, { paddingTop: insets.top, paddingBottom: insets.bottom + scaleSize(20) }, recordAnimStyle]}>
          {/* Waveform */}
          <View style={styles.recordWaveWrap}>
            {Array.from({ length: 40 }, (_, i) => {
              const norm = recordingMetering != null
                ? Math.max(0, Math.min(1, (recordingMetering + 160) / 160))
                : 0.15;
              const wave = 0.3 + 0.7 * (Math.sin(i * 0.45) * 0.5 + 0.5);
              const h = Math.max(4, Math.round(norm * wave * 60));
              return (
                <View
                  key={i}
                  style={[
                    styles.recordWaveBar,
                    { height: h, opacity: isPaused ? 0.4 : 1 },
                  ]}
                />
              );
            })}
          </View>

          {/* Status + timer */}
          <View style={styles.recordStatusWrap}>
            <View style={styles.recordDot} />
            <Text style={styles.recordStatusText}>RECORDING</Text>
          </View>
          <Text style={styles.recordTimer}>{formatTime(recordingDuration)}</Text>

          {/* Controls */}
          <View style={styles.recordControlsRow}>
            <Pressable style={styles.recordCtrlBtn} onPress={cancelRecord}>
              <View style={styles.recordCtrlCircle}>
                <Text style={{ fontSize: scaleFont(18) }}>✕</Text>
              </View>
              <Text style={styles.recordCtrlLabel}>Cancel</Text>
            </Pressable>

            <Pressable style={styles.recordStopBtn} onPress={stopAndSave}>
              <View style={styles.recordStopCircle}>
                <View style={styles.recordStopSquare} />
              </View>
            </Pressable>

            <Pressable style={styles.recordCtrlBtn} onPress={isPaused ? resumeRecording : pauseRecording}>
              <View style={styles.recordCtrlCircle}>
                <Text style={{ fontSize: scaleFont(18) }}>{isPaused ? '▶' : '⏸'}</Text>
              </View>
              <Text style={styles.recordCtrlLabel}>{isPaused ? 'Resume' : 'Pause'}</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scaleSize(20),
    paddingTop: scaleSize(8),
  },
  pageTitle: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(34),
    fontWeight: '700',
    color: DEEP_BLACK,
    paddingHorizontal: scaleSize(20),
    paddingTop: scaleSize(12),
    letterSpacing: -0.5,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(8),
    backgroundColor: '#FFFFFF',
    marginHorizontal: scaleSize(20),
    marginTop: scaleSize(12),
    paddingHorizontal: scaleSize(14),
    paddingVertical: scaleSize(12),
    borderRadius: scaleSize(14),
  },
  searchInput: {
    flex: 1,
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    color: DEEP_BLACK,
    padding: 0,
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaleSize(20),
    paddingVertical: scaleSize(14),
    gap: scaleSize(8),
  },
  filterPill: {
    alignSelf: 'flex-start',
    backgroundColor: PILL_GRAY,
    paddingHorizontal: scaleSize(16),
    paddingVertical: scaleSize(8),
    borderRadius: 999,
  },
  filterPillSelected: { backgroundColor: DEEP_BLACK },
  filterText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(14),
    fontWeight: '600',
    color: DEEP_BLACK,
  },
  filterTextSelected: { color: '#FFFFFF' },
  sectionLabel: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(13),
    color: SUBTITLE_GRAY,
    marginBottom: scaleSize(10),
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(12),
    backgroundColor: CARD,
    borderRadius: scaleSize(16),
    padding: scaleSize(14),
  },
  noteIconWrap: {
    width: scaleSize(40),
    height: scaleSize(40),
    borderRadius: scaleSize(10),
    backgroundColor: '#F2F2F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteTitle: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    fontWeight: '700',
    color: DEEP_BLACK,
    marginBottom: scaleSize(2),
  },
  noteSubtitle: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(14),
    color: DEEP_BLACK,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: scaleSize(80),
    paddingHorizontal: scaleSize(40),
  },
  folderEmoji: { fontSize: scaleFont(56), marginBottom: scaleSize(16) },
  emptyTitle: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(18),
    fontWeight: '700',
    color: DEEP_BLACK,
    marginBottom: scaleSize(8),
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(14),
    color: SUBTITLE_GRAY,
    textAlign: 'center',
    marginBottom: scaleSize(20),
    lineHeight: scaleFont(20),
  },
  emptyCta: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: scaleSize(28),
    paddingVertical: scaleSize(14),
    borderRadius: scaleSize(14),
  },
  emptyCtaText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    fontWeight: '600',
    color: DEEP_BLACK,
  },
  fabWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  fab: {
    backgroundColor: DEEP_BLACK,
    paddingHorizontal: scaleSize(40),
    paddingVertical: scaleSize(18),
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  fabText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: scaleSize(24),
    borderTopRightRadius: scaleSize(24),
    paddingTop: scaleSize(20),
    paddingHorizontal: scaleSize(20),
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scaleSize(20),
  },
  sheetTitle: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(22),
    fontWeight: '700',
    color: DEEP_BLACK,
  },
  sheetClose: {
    width: scaleSize(32),
    height: scaleSize(32),
    borderRadius: scaleSize(16),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(14),
    backgroundColor: '#FFFFFF',
    borderRadius: scaleSize(14),
    paddingVertical: scaleSize(14),
    paddingHorizontal: scaleSize(16),
    marginBottom: scaleSize(10),
  },
  sheetIconCircle: {
    width: scaleSize(40),
    height: scaleSize(40),
    borderRadius: scaleSize(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOptionText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: DEEP_BLACK,
  },
  // YouTube sheet
  ytInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: scaleSize(14),
    paddingHorizontal: scaleSize(14),
    paddingVertical: scaleSize(12),
    marginBottom: scaleSize(8),
    gap: scaleSize(8),
  },
  ytInput: {
    flex: 1,
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    color: DEEP_BLACK,
    padding: 0,
  },
  ytPasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(4),
  },
  ytPasteText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(13),
    color: DEEP_BLACK,
    fontWeight: '500',
  },
  ytHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(4),
    justifyContent: 'center',
    marginBottom: scaleSize(20),
  },
  ytHint: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(13),
    color: SUBTITLE_GRAY,
  },
  ytSubmit: {
    backgroundColor: DEEP_BLACK,
    borderRadius: scaleSize(16),
    paddingVertical: scaleSize(18),
    alignItems: 'center',
  },
  ytSubmitText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(17),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Recording screen
  recordScreen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  recordWaveWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(3),
    height: scaleSize(80),
    marginBottom: scaleSize(40),
    paddingHorizontal: scaleSize(20),
  },
  recordWaveBar: {
    flex: 1,
    backgroundColor: ACCENT_BLUE,
    borderRadius: 2,
  },
  recordStatusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(6),
    marginBottom: scaleSize(6),
  },
  recordDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  recordStatusText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(13),
    fontWeight: '700',
    color: '#EF4444',
    letterSpacing: 1,
  },
  recordTimer: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(52),
    fontWeight: '700',
    color: DEEP_BLACK,
    letterSpacing: -1,
    marginBottom: scaleSize(48),
  },
  recordControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: scaleSize(40),
    marginBottom: scaleSize(20),
  },
  recordCtrlBtn: { alignItems: 'center', gap: scaleSize(8) },
  recordCtrlCircle: {
    width: scaleSize(60),
    height: scaleSize(60),
    borderRadius: scaleSize(30),
    backgroundColor: '#F2F2F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordCtrlLabel: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(13),
    color: DEEP_BLACK,
  },
  recordStopBtn: { alignItems: 'center' },
  recordStopCircle: {
    width: scaleSize(72),
    height: scaleSize(72),
    borderRadius: scaleSize(36),
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordStopSquare: {
    width: scaleSize(26),
    height: scaleSize(26),
    borderRadius: scaleSize(4),
    backgroundColor: '#FFFFFF',
  },
});
