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
import { isYouTubeUrl, extractVideoId, fetchYouTubeTranscript } from '@/lib/youtube-transcript';
import { callOpenAI } from '@/lib/openai-service';
import {
  addProNote,
  createFolder,
  getAllFolders,
  getAllProNotes,
  getNotesInFolder,
  hydrateProNotes,
  subscribeProNotes,
  type ProNote,
} from '@/lib/pro-note-store';
import { transcribeAudio } from '@/lib/transcription';

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
  const [savedNotes, setSavedNotes] = useState<ReturnType<typeof getAllProNotes>>(getAllProNotes());
  const [folders, setFolders] = useState(getAllFolders());

  // Folder creation
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeProNotes(() => {
      setSavedNotes(getAllProNotes());
      setFolders(getAllFolders());
    });
    hydrateProNotes().then(() => {
      setSavedNotes(getAllProNotes());
      setFolders(getAllFolders());
    });
    return () => { unsub(); };
  }, []);

  // YouTube sheet
  const [showYouTube, setShowYouTube] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [ytStatus, setYtStatus] = useState<string | null>(null);
  const [ytError, setYtError] = useState<string | null>(null);

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

  // Recording-save state
  const [savingRecording, setSavingRecording] = useState(false);
  const [savingMessage, setSavingMessage] = useState<string | null>(null);

  const generateNoteFromTranscript = useCallback(
    async (transcript: string, extras: Partial<ProNote> = {}): Promise<string> => {
      const structured = await callOpenAI<{
        title: string;
        subtitle: string;
        overview: Array<{ bold?: string; text: string }>;
        keyTopics: Array<{ bold?: string; text: string }>;
        actionItems: string[];
        finalReflection: string;
      }>(
        'You are an expert professional note-taker. Return only valid JSON — no markdown, no code fences.',
        `Analyze this transcript and return a JSON object with this exact shape:
{
  "title": "Main topic in 3-6 words",
  "subtitle": "One sentence describing the content",
  "overview": [
    { "bold": "Main Focus", "text": "what this is primarily about" },
    { "bold": "Core Problem Addressed", "text": "the key challenge or question" }
  ],
  "keyTopics": [
    { "bold": "Topic Name", "text": "brief explanation" }
  ],
  "actionItems": [
    "Concrete next step 1",
    "Concrete next step 2",
    "Concrete next step 3"
  ],
  "finalReflection": "A 2-3 sentence reflection on the practical value or takeaway."
}

Transcript:
${transcript.slice(0, 12000)}`
      );
      return addProNote({ ...structured, transcript, ...extras });
    },
    []
  );

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
    setSavingRecording(true);
    setSavingMessage('Stopping recording…');
    let uri: string | null = null;
    try {
      await recording.stopAndUnloadAsync();
      uri = recording.getURI();
    } catch (e) {
      console.error('stopRecording failed', e);
    }
    setRecording(null);
    setIsPaused(false);
    setRecordingDuration(0);
    setRecordingMetering(null);

    if (!uri) {
      setSavingRecording(false);
      setSavingMessage(null);
      recordSlide.value = withTiming(1, { duration: 300, easing: Easing.in(Easing.cubic) }, () =>
        runOnJS(setShowRecord)(false)
      );
      Alert.alert('Recording failed', 'No audio captured.');
      return;
    }

    try {
      setSavingMessage('Transcribing audio…');
      const transcript = await transcribeAudio(uri);
      if (!transcript.trim()) throw new Error('Transcription returned no text.');
      setSavingMessage('Generating notes…');
      const noteId = await generateNoteFromTranscript(transcript, { audioUri: uri });
      setSavingRecording(false);
      setSavingMessage(null);
      recordSlide.value = withTiming(1, { duration: 300, easing: Easing.in(Easing.cubic) }, () =>
        runOnJS(setShowRecord)(false)
      );
      router.push({
        pathname: '/professional-note-detail',
        params: { generated: '1', noteId },
      });
    } catch (e: any) {
      setSavingRecording(false);
      setSavingMessage(null);
      recordSlide.value = withTiming(1, { duration: 300, easing: Easing.in(Easing.cubic) }, () =>
        runOnJS(setShowRecord)(false)
      );
      Alert.alert('Could not save recording', e?.message ?? 'Please try again.');
    }
  }, [recording, generateNoteFromTranscript]);

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
      setSavingRecording(true);
      setSavingMessage('Transcribing audio…');
      try {
        const transcript = await transcribeAudio(file.uri);
        if (!transcript.trim()) throw new Error('Transcription returned no text.');
        setSavingMessage('Generating notes…');
        const noteId = await generateNoteFromTranscript(transcript, { audioUri: file.uri });
        setSavingRecording(false);
        setSavingMessage(null);
        router.push({
          pathname: '/professional-note-detail',
          params: { generated: '1', noteId },
        });
      } catch (e: any) {
        setSavingRecording(false);
        setSavingMessage(null);
        Alert.alert('Could not process audio', e?.message ?? 'Please try again.');
      }
    } catch (e) {
      console.error('Audio picker failed', e);
    }
  };

  const handleYouTubeSubmit = async () => {
    const url = youtubeUrl.trim();
    if (!url) return;
    if (!isYouTubeUrl(url)) {
      setYtError('Please enter a valid YouTube URL.');
      return;
    }
    const videoId = extractVideoId(url);
    if (!videoId) {
      setYtError('Could not extract video ID from URL.');
      return;
    }

    setYtError(null);
    setYtStatus('Fetching transcript…');

    const result = await fetchYouTubeTranscript(videoId, (msg) => setYtStatus(msg));
    if (result.error || !result.text) {
      setYtStatus(null);
      setYtError(result.error ?? 'Failed to fetch transcript.');
      return;
    }

    setYtStatus('Generating notes…');

    try {
      const id = await generateNoteFromTranscript(result.text, { sourceUrl: url });
      setShowYouTube(false);
      setYoutubeUrl('');
      setYtStatus(null);
      setYtError(null);
      router.push({
        pathname: '/professional-note-detail',
        params: { generated: '1', noteId: id },
      });
    } catch (e: any) {
      setYtStatus(null);
      setYtError(e?.message ?? 'Failed to generate notes. Please try again.');
    }
  };

  const handleCreateFolder = () => {
    const name = folderName.trim();
    if (!name) return;
    hapticSelect();
    createFolder(name);
    setFolderName('');
    setShowCreateFolder(false);
  };

  // ─── Content ─────────────────────────────────────────────────────────────
  const renderContent = () => {
    if (filter === 'folders') {
      if (folders.length === 0) {
        return (
          <View style={styles.emptyWrap}>
            <Text style={styles.folderEmoji}>📁</Text>
            <Text style={styles.emptyTitle}>Create Your First Folder</Text>
            <Text style={styles.emptySubtitle}>
              Organize notes into folders{'\n'}for easy access
            </Text>
            <Pressable
              style={({ pressed }) => [styles.emptyCta, pressed && { opacity: 0.85 }]}
              onPress={() => { hapticSelect(); setShowCreateFolder(true); }}
            >
              <Text style={styles.emptyCtaText}>Create Folder</Text>
            </Pressable>
          </View>
        );
      }
      return (
        <View style={{ paddingHorizontal: scaleSize(20), paddingTop: scaleSize(8) }}>
          <Pressable
            style={({ pressed }) => [styles.newFolderRow, pressed && { opacity: 0.85 }]}
            onPress={() => { hapticSelect(); setShowCreateFolder(true); }}
          >
            <Ionicons name="add-circle-outline" size={22} color={DEEP_BLACK} />
            <Text style={styles.newFolderText}>New folder</Text>
          </Pressable>
          {folders.map((f) => {
            const count = getNotesInFolder(f.id).length;
            return (
              <Pressable
                key={f.id}
                style={({ pressed }) => [styles.noteCard, pressed && { opacity: 0.85 }]}
                onPress={() => { hapticSelect(); setFilter('all'); setActiveFolderId(f.id); }}
              >
                <View style={styles.noteIconWrap}>
                  <Text style={{ fontSize: scaleFont(20) }}>📁</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.noteTitle}>{f.name}</Text>
                  <Text style={styles.noteSubtitle}>{count} {count === 1 ? 'note' : 'notes'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={DEEP_BLACK} />
              </Pressable>
            );
          })}
        </View>
      );
    }

    const folderFilter = activeFolderId
      ? savedNotes.filter((n) => n.folderId === activeFolderId)
      : savedNotes;
    const activeFolder = activeFolderId ? folders.find((f) => f.id === activeFolderId) : null;

    const allNotes = [
      ...(activeFolderId ? [] : SAMPLE_NOTES.map((n) => ({ ...n, generated: false }))),
      ...folderFilter.map((n) => ({ id: n.id, title: n.title, subtitle: n.subtitle, unread: false, generated: true })),
    ];

    const filtered = search.trim()
      ? allNotes.filter(
          (n) =>
            n.title.toLowerCase().includes(search.toLowerCase()) ||
            n.subtitle.toLowerCase().includes(search.toLowerCase())
        )
      : allNotes;

    return (
      <View style={{ paddingHorizontal: scaleSize(20), paddingTop: scaleSize(8) }}>
        {activeFolder ? (
          <Pressable
            style={styles.folderBreadcrumb}
            onPress={() => { hapticSelect(); setActiveFolderId(null); setFilter('folders'); }}
          >
            <Ionicons name="chevron-back" size={18} color={DEEP_BLACK} />
            <Text style={styles.folderBreadcrumbText}>{activeFolder.name}</Text>
          </Pressable>
        ) : null}
        <Text style={styles.sectionLabel}>{activeFolder ? 'In this folder' : 'Today'}</Text>
        {filtered.map((note) => (
          <Pressable
            key={note.id}
            style={({ pressed }) => [styles.noteCard, pressed && { opacity: 0.85 }]}
            onPress={() => {
              hapticSelect();
              if (note.generated) {
                router.push({
                  pathname: '/professional-note-detail',
                  params: { title: note.title, subtitle: note.subtitle, generated: '1', noteId: note.id },
                });
              } else {
                router.push({
                  pathname: '/professional-note-detail',
                  params: { id: note.id, title: note.title, subtitle: note.subtitle },
                });
              }
            }}
          >
            <View style={styles.noteIconWrap}>
              <Text style={{ fontSize: scaleFont(20) }}>{note.generated ? '📝' : '⭐'}</Text>
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
        <Pressable
          hitSlop={12}
          onPress={() => { hapticSelect(); router.push('/settings'); }}
        >
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

            {ytStatus ? (
              <Text style={styles.ytStatus}>{ytStatus}</Text>
            ) : null}
            {ytError ? (
              <Text style={styles.ytError}>{ytError}</Text>
            ) : null}

            <Pressable
              style={({ pressed }) => [styles.ytSubmit, !!ytStatus && styles.ytSubmitDisabled, pressed && !ytStatus && { opacity: 0.85 }]}
              onPress={handleYouTubeSubmit}
              disabled={!!ytStatus}
            >
              <Text style={styles.ytSubmitText}>{ytStatus ? 'Processing…' : 'Submit'}</Text>
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

      {/* ── Create folder modal ── */}
      <Modal visible={showCreateFolder} transparent animationType="fade" onRequestClose={() => setShowCreateFolder(false)}>
        <Pressable style={styles.dimBackdrop} onPress={() => setShowCreateFolder(false)}>
          <Pressable style={styles.dialog} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.dialogTitle}>New folder</Text>
            <TextInput
              value={folderName}
              onChangeText={setFolderName}
              placeholder="Folder name"
              placeholderTextColor={SUBTITLE_GRAY}
              style={styles.dialogInput}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreateFolder}
            />
            <View style={styles.dialogBtnRow}>
              <Pressable
                style={[styles.dialogBtn, styles.dialogBtnGhost]}
                onPress={() => { setFolderName(''); setShowCreateFolder(false); }}
              >
                <Text style={styles.dialogBtnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.dialogBtn, styles.dialogBtnPrimary, !folderName.trim() && { opacity: 0.5 }]}
                onPress={handleCreateFolder}
                disabled={!folderName.trim()}
              >
                <Text style={styles.dialogBtnPrimaryText}>Create</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Saving overlay (transcription / generation) ── */}
      {savingRecording && (
        <View style={styles.savingOverlay} pointerEvents="auto">
          <View style={styles.savingCard}>
            <Text style={styles.savingTitle}>Saving recording</Text>
            <Text style={styles.savingMessage}>{savingMessage ?? 'Working…'}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  folderBreadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(4),
    paddingVertical: scaleSize(8),
    marginBottom: scaleSize(4),
  },
  folderBreadcrumbText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    fontWeight: '600',
    color: DEEP_BLACK,
  },
  newFolderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(10),
    backgroundColor: '#FFFFFF',
    borderRadius: scaleSize(14),
    paddingVertical: scaleSize(14),
    paddingHorizontal: scaleSize(16),
    marginBottom: scaleSize(10),
  },
  newFolderText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    fontWeight: '600',
    color: DEEP_BLACK,
  },
  dimBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scaleSize(24),
  },
  dialog: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: scaleSize(16),
    padding: scaleSize(20),
  },
  dialogTitle: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(18),
    fontWeight: '700',
    color: DEEP_BLACK,
    marginBottom: scaleSize(14),
  },
  dialogInput: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    color: DEEP_BLACK,
    backgroundColor: '#F2F2F4',
    borderRadius: scaleSize(10),
    paddingHorizontal: scaleSize(12),
    paddingVertical: scaleSize(12),
    marginBottom: scaleSize(16),
  },
  dialogBtnRow: { flexDirection: 'row', gap: scaleSize(10) },
  dialogBtn: {
    flex: 1,
    borderRadius: scaleSize(12),
    paddingVertical: scaleSize(12),
    alignItems: 'center',
  },
  dialogBtnGhost: { backgroundColor: '#F2F2F4' },
  dialogBtnGhostText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    fontWeight: '600',
    color: DEEP_BLACK,
  },
  dialogBtnPrimary: { backgroundColor: DEEP_BLACK },
  dialogBtnPrimaryText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scaleSize(40),
  },
  savingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: scaleSize(16),
    padding: scaleSize(24),
    width: '100%',
    alignItems: 'center',
  },
  savingTitle: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(17),
    fontWeight: '700',
    color: DEEP_BLACK,
    marginBottom: scaleSize(8),
  },
  savingMessage: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(14),
    color: SUBTITLE_GRAY,
  },
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
  ytSubmitDisabled: {
    opacity: 0.55,
  },
  ytStatus: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(14),
    color: SUBTITLE_GRAY,
    textAlign: 'center',
    marginBottom: scaleSize(10),
  },
  ytError: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(14),
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: scaleSize(10),
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
