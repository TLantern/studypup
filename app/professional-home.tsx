import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Clipboard,
  InteractionManager,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import LottieView from 'lottie-react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import RECORDING_PHRASES_JSON from '../recording-phrases.json';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  getProNoteById,
  hydrateProNotes,
  subscribeProNotes,
  updateProNote,
  type ProNote,
} from '@/lib/pro-note-store';
import { transcribeAudio } from '@/lib/transcription';
import { RecordingWaveform } from '@/components/RecordingWaveform';

const RECORDING_TIPS = [
  "Say names out loud, it helps attribute who said what",
  "State action items clearly — who, what, and by when",
  "Summarize decisions out loud before moving on",
  "Spell out acronyms the first time you use them",
  "The more context you speak, the richer your notes",
  "State the date and parties present at the start",
  "Speak at a normal pace — rushing creates gaps",
  "Avoid talking over each other for cleaner transcription",
];

function FirstRecordingOverlay({ almostDone }: { almostDone: boolean }) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);
  const indexRef = useRef(0);
  const lottieRef = useRef<LottieView>(null);

  useEffect(() => { lottieRef.current?.play(); }, []);

  useEffect(() => {
    if (almostDone) return;
    const t = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) }, () => {
        const next = (indexRef.current + 1) % RECORDING_TIPS.length;
        indexRef.current = next;
        runOnJS(setPhraseIndex)(next);
        translateY.value = 10;
        opacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) });
        translateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) });
      });
    }, 3500);
    return () => clearTimeout(t);
  }, [phraseIndex, almostDone]);

  useEffect(() => {
    if (!almostDone) return;
    opacity.value = withTiming(0, { duration: 300 }, () => {
      opacity.value = withTiming(1, { duration: 300 });
    });
  }, [almostDone]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={firstRecStyles.container}>
      <LottieView
        ref={lottieRef}
        source={require('../transcribe.json')}
        style={firstRecStyles.lottie}
        loop
      />
      <Animated.Text style={[firstRecStyles.text, animStyle]}>
        {almostDone ? 'Almost done...' : RECORDING_TIPS[phraseIndex]}
      </Animated.Text>
    </View>
  );
}

const firstRecStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  lottie: { width: 280, height: 280 },
  text: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginTop: 24,
  },
});

function RotatingPhrase() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);
  const indexRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) }, () => {
        const next = (indexRef.current + 1) % RECORDING_PHRASES_JSON.length;
        indexRef.current = next;
        runOnJS(setPhraseIndex)(next);
        translateY.value = 10;
        opacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) });
        translateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) });
      });
    }, 3500);
    return () => clearTimeout(t);
  }, [phraseIndex]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.Text style={[rotatingPhraseStyle, animStyle]}>
      {RECORDING_PHRASES_JSON[phraseIndex]}
    </Animated.Text>
  );
}

const rotatingPhraseStyle = {
  fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
  fontSize: scaleFont(22),
  fontWeight: '600' as const,
  color: '#9CA3AF',
  textAlign: 'center' as const,
  paddingHorizontal: scaleSize(32),
};

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
  { id: 'record', label: 'Record Audio', emoji: '🎙️', bg: '#FBD3D8' },
  { id: 'todo', label: 'To-do List', emoji: '📝', bg: '#D8F3DC' },
  { id: 'youtube', label: 'YouTube Video', emoji: '▶️', bg: '#FBE0B5' },
  { id: 'voice', label: 'Upload voice memo', emoji: '🎵', bg: '#BBD4FB' },
] as const;

const TODO_STORAGE_KEY = '@studypup/todo-list';

type TodoItem = { id: string; text: string; done: boolean };

function getContentEmoji(title: string, subtitle: string): string {
  const text = `${title} ${subtitle}`.toLowerCase();
  if (/meet|call|zoom|standup|sync|agenda/.test(text)) return '📅';
  if (/code|engineer|software|dev|tech|api|bug|deploy/.test(text)) return '💻';
  if (/design|ui|ux|figma|wireframe|prototype/.test(text)) return '🎨';
  if (/market|brand|campaign|ads|seo|growth/.test(text)) return '📈';
  if (/finance|budget|revenue|cost|profit|money/.test(text)) return '💰';
  if (/health|medical|fitness|wellness|doctor/.test(text)) return '🏥';
  if (/legal|contract|law|compliance|policy/.test(text)) return '⚖️';
  if (/product|launch|roadmap|feature|milestone/.test(text)) return '🚀';
  if (/research|study|analysis|data|report/.test(text)) return '🔬';
  if (/team|people|hr|recruit|hire|culture/.test(text)) return '👥';
  if (/sales|pitch|client|deal|prospect/.test(text)) return '🤝';
  if (/learn|course|training|education|tutorial/.test(text)) return '📚';
  if (/idea|brainstorm|creative|concept|innovation/.test(text)) return '💡';
  if (/strategy|plan|goal|vision|mission/.test(text)) return '🎯';
  if (/write|content|blog|article|copy/.test(text)) return '✍️';
  if (/youtube|video|watch|film|podcast/.test(text)) return '▶️';
  if (/audio|record|voice|speech|sound/.test(text)) return '🎙️';
  return '📝';
}

const SAMPLE_NOTES = [
  {
    id: 'welcome',
    title: 'Welcome to the App!',
    subtitle: 'Discover all features today',
    unread: true,
    createdAt: Date.now(),
  },
];

function formatNoteDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ProfessionalHomeScreen() {
  const insets = useSafeAreaInsets();
  const { openFolders } = useLocalSearchParams<{ openFolders?: string }>();
  const [filter, setFilter] = useState<FilterTab>(openFolders === '1' ? 'folders' : 'all');
  const [search, setSearch] = useState('');
  const [showNewNote, setShowNewNote] = useState(false);
  const [savedNotes, setSavedNotes] = useState<ReturnType<typeof getAllProNotes>>(getAllProNotes());
  const [folders, setFolders] = useState(getAllFolders());

  // Folder creation
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  // Move-to-folder sheet
  const [moveNoteId, setMoveNoteId] = useState<string | null>(null);

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

  // To-do list
  const [showTodo, setShowTodo] = useState(false);
  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
  const [todoInput, setTodoInput] = useState('');
  const [todoTitle, setTodoTitle] = useState('');
  const [todoCreatedAt, setTodoCreatedAt] = useState<Date>(new Date());
  const [editingTodoNoteId, setEditingTodoNoteId] = useState<string | null>(null);
  const todoHydratedRef = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(TODO_STORAGE_KEY).then((raw) => {
      if (raw) {
        try { setTodoItems(JSON.parse(raw)); } catch {}
      }
      todoHydratedRef.current = true;
    });
  }, []);

  useEffect(() => {
    if (!todoHydratedRef.current) return;
    AsyncStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todoItems)).catch(() => {});
  }, [todoItems]);

  const closeTodoAndSave = () => {
    if (todoItems.length > 0 || todoTitle.trim()) {
      const payload = {
        title: todoTitle.trim() || 'To-do List',
        subtitle: 'To-do List',
        overview: [] as import('@/lib/pro-note-store').ProNoteBullet[],
        keyTopics: [] as import('@/lib/pro-note-store').ProNoteBullet[],
        actionItems: todoItems.map((t) => (t.done ? '✓ ' : '') + t.text),
        finalReflection: '',
        noteType: 'todo' as const,
      };
      if (editingTodoNoteId) {
        updateProNote(editingTodoNoteId, payload);
      } else {
        addProNote({ ...payload, createdAt: todoCreatedAt.getTime() });
      }
      setTodoItems([]);
      setTodoTitle('');
      setEditingTodoNoteId(null);
    }
    setShowTodo(false);
  };

  const addTodoItem = () => {
    const text = todoInput.trim();
    if (!text) return;
    hapticSelect();
    setTodoItems((prev) => [...prev, { id: `${Date.now()}`, text, done: false }]);
    setTodoInput('');
  };

  const toggleTodoItem = (id: string) => {
    hapticSelect();
    setTodoItems((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const removeTodoItem = (id: string) => {
    hapticSelect();
    setTodoItems((prev) => prev.filter((t) => t.id !== id));
  };

  // Recording
  const [showRecord, setShowRecord] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingMetering, setRecordingMetering] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingRecordRef = useRef(false);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setRecordingDuration((p) => p + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const recordSlide = useSharedValue(1);
  const recordAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: recordSlide.value * 600 }],
  }));

  useEffect(() => {
    trackPageViewed('professional_home');
  }, []);

  // ─── Recording helpers ───────────────────────────────────────────────────
  const beginRecording = useCallback(async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Microphone access needed',
          'Enable microphone access in Settings to record notes.'
        );
        recordSlide.value = withTiming(1, { duration: 250, easing: Easing.in(Easing.cubic) }, () =>
          runOnJS(setShowRecord)(false)
        );
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
          isMeteringEnabled: true,
        },
        (s) => {
          if (s.metering != null) setRecordingMetering(s.metering);
        },
        100
      );
      recordingRef.current = rec;
      setRecording(rec);
      setRecordingDuration(0);
      setIsPaused(false);
      setRecordingMetering(null);
      activateKeepAwakeAsync();
      startTimer();
    } catch (e) {
      console.error('startRecording failed', e);
      Alert.alert('Could not start recording', (e as Error)?.message ?? 'Please try again.');
      recordSlide.value = withTiming(1, { duration: 250, easing: Easing.in(Easing.cubic) }, () =>
        runOnJS(setShowRecord)(false)
      );
    }
  }, [startTimer]);

  const openRecord = useCallback(() => {
    pendingRecordRef.current = true;
    setShowRecord(true);
    recordSlide.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) });
  }, []);

  useEffect(() => {
    if (!showRecord || !pendingRecordRef.current) return;
    const task = InteractionManager.runAfterInteractions(() => {
      pendingRecordRef.current = false;
      beginRecording();
    });
    return () => task.cancel();
  }, [showRecord, beginRecording]);

  const pauseRecording = useCallback(async () => {
    const rec = recordingRef.current;
    if (!rec || isPaused) return;
    try {
      await rec.pauseAsync();
    } catch (e) {
      console.error('pauseRecording failed', e);
      return;
    }
    setIsPaused(true);
    setRecordingMetering(null);
    stopTimer();
    deactivateKeepAwake();
  }, [isPaused, stopTimer]);

  const resumeRecording = useCallback(async () => {
    const rec = recordingRef.current;
    if (!rec || !isPaused) return;
    try {
      await rec.startAsync();
    } catch (e) {
      console.error('resumeRecording failed', e);
      return;
    }
    setIsPaused(false);
    activateKeepAwakeAsync();
    startTimer();
  }, [isPaused, startTimer]);

  // Recording-save state
  const [savingRecording, setSavingRecording] = useState(false);
  const [savingMessage, setSavingMessage] = useState<string | null>(null);
  const [showFirstRecordingOverlay, setShowFirstRecordingOverlay] = useState(false);
  const [overlayAlmostDone, setOverlayAlmostDone] = useState(false);

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
  "title": "Main topic in 2-4 words",
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
    pendingRecordRef.current = false;
    const rec = recordingRef.current;
    if (rec) {
      rec.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
      setRecording(null);
    }
    stopTimer();
    setIsPaused(false);
    setRecordingDuration(0);
    setRecordingMetering(null);
    deactivateKeepAwake();
    recordSlide.value = withTiming(1, { duration: 300, easing: Easing.in(Easing.cubic) }, () =>
      runOnJS(setShowRecord)(false)
    );
  }, [stopTimer]);

  const stopAndSave = useCallback(async () => {
    const rec = recordingRef.current;
    if (!rec) return;
    stopTimer();
    deactivateKeepAwake();

    setShowFirstRecordingOverlay(true);

    let uri: string | null = null;
    try {
      await rec.stopAndUnloadAsync();
      uri = rec.getURI();
    } catch (e) {
      console.error('stopRecording failed', e);
    }
    recordingRef.current = null;
    setRecording(null);
    setIsPaused(false);
    setRecordingDuration(0);
    setRecordingMetering(null);

    if (!uri) {
      setShowFirstRecordingOverlay(false);
      setSavingRecording(false);
      setSavingMessage(null);
      recordSlide.value = withTiming(1, { duration: 300, easing: Easing.in(Easing.cubic) }, () =>
        runOnJS(setShowRecord)(false)
      );
      Alert.alert('Recording failed', 'No audio captured.');
      return;
    }

    try {
      const transcript = await transcribeAudio(uri);
      if (!transcript.trim()) throw new Error('Transcription returned no text.');
      setOverlayAlmostDone(true);
      const noteId = await generateNoteFromTranscript(transcript, { audioUri: uri });
      setShowFirstRecordingOverlay(false);
      setOverlayAlmostDone(false);
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
      setShowFirstRecordingOverlay(false);
      setOverlayAlmostDone(false);
      setSavingRecording(false);
      setSavingMessage(null);
      recordSlide.value = withTiming(1, { duration: 300, easing: Easing.in(Easing.cubic) }, () =>
        runOnJS(setShowRecord)(false)
      );
      Alert.alert('Could not save recording', e?.message ?? 'Please try again.');
    }
  }, [generateNoteFromTranscript, stopTimer]);

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
    } else if (id === 'todo') {
      setTodoCreatedAt(new Date());
      setTodoTitle('');
      setTimeout(() => setShowTodo(true), 300);
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
    const folder = createFolder(name);
    setFolderName('');
    setShowCreateFolder(false);
    if (moveNoteId) {
      updateProNote(moveNoteId, { folderId: folder.id });
      setMoveNoteId(null);
      setActiveFolderId(null);
      setFilter('folders');
    }
  };

  const handleAssignToFolder = (folderId: string) => {
    if (!moveNoteId) return;
    hapticSelect();
    updateProNote(moveNoteId, { folderId });
    setMoveNoteId(null);
    setActiveFolderId(null);
    setFilter('folders');
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
      ...(activeFolderId ? [] : SAMPLE_NOTES.map((n) => ({ ...n, generated: false, noteType: undefined as 'todo' | undefined }))),
      ...folderFilter.map((n) => ({ id: n.id, title: n.title, subtitle: n.subtitle, unread: false, generated: true, createdAt: n.createdAt, noteType: n.noteType })),
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
            onLongPress={() => {
              if (!note.generated) return;
              hapticSelect();
              setMoveNoteId(note.id);
            }}
            delayLongPress={350}
            onPress={() => {
              hapticSelect();
              if (note.generated && note.noteType === 'todo') {
                const stored = getProNoteById(note.id);
                if (stored) {
                  setTodoTitle(stored.title === 'To-do List' ? '' : stored.title);
                  setTodoCreatedAt(new Date(stored.createdAt));
                  setEditingTodoNoteId(stored.id);
                  setTodoItems(
                    stored.actionItems.map((text: string, i: number) => ({
                      id: `${stored.id}_${i}`,
                      text: text.startsWith('✓ ') ? text.slice(2) : text,
                      done: text.startsWith('✓ '),
                    }))
                  );
                  setShowTodo(true);
                }
              } else if (note.generated) {
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
              <Text style={{ fontSize: scaleFont(20) }}>{note.generated ? getContentEmoji(note.title, note.subtitle) : '⭐'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.noteTitle}>{note.title}</Text>
              <Text style={styles.noteSubtitle}>{note.createdAt ? formatNoteDate(note.createdAt) : ''}</Text>
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
          {/* Rotating phrase — centered in the space above the waveform */}
          <View style={styles.rotatingPhraseWrap}>
            <RotatingPhrase />
          </View>

          {/* Waveform */}
          <View style={{ marginBottom: scaleSize(80) }}>
            <RecordingWaveform metering={recordingMetering} isPaused={isPaused} />
          </View>

          {/* Status + timer */}
          <View style={styles.recordStatusWrap}>
            <View style={styles.recordDot} />
            <Text style={styles.recordStatusText}>RECORDING</Text>
          </View>
          <Text style={styles.recordTimer}>{formatTime(recordingDuration)}</Text>

          {/* Controls */}
          <View style={styles.recordControlsRow}>
            <Pressable style={[styles.recordCtrlBtn, { marginTop: scaleSize(28) }]} onPress={cancelRecord}>
              <View style={styles.recordCtrlCircle}>
                <Ionicons name="close" size={scaleFont(22)} color={DEEP_BLACK} />
              </View>
              <Text style={styles.recordCtrlLabel}>Cancel</Text>
            </Pressable>

            <Pressable style={styles.recordStopBtn} onPress={stopAndSave}>
              <View style={styles.recordStopCircle}>
                <View style={styles.recordStopSquare} />
              </View>
            </Pressable>

            <Pressable style={[styles.recordCtrlBtn, { marginTop: scaleSize(28) }]} onPress={isPaused ? resumeRecording : pauseRecording}>
              <View style={styles.recordCtrlCircle}>
                <Ionicons name={isPaused ? 'play' : 'pause'} size={scaleFont(22)} color={DEEP_BLACK} />
              </View>
              <Text style={styles.recordCtrlLabel}>{isPaused ? 'Resume' : 'Pause'}</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* ── To-do list notepad ── */}
      <Modal visible={showTodo} transparent animationType="slide" onRequestClose={closeTodoAndSave}>
        <View style={styles.todoBackdrop}>
          <View style={[styles.todoSheet, { paddingTop: insets.top + scaleSize(8), paddingBottom: insets.bottom + scaleSize(16) }]}>
            <View style={styles.todoHeader}>
              <Pressable hitSlop={12} onPress={closeTodoAndSave} style={styles.todoBackBtn}>
                <Ionicons name="chevron-back" size={scaleFont(24)} color={DEEP_BLACK} />
              </Pressable>
              <Text style={styles.todoDateText}>
                {todoCreatedAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                {' at '}
                {todoCreatedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </Text>
              <View style={{ width: scaleSize(32) }} />
            </View>

            <TextInput
              value={todoTitle}
              onChangeText={setTodoTitle}
              placeholder="New Note"
              placeholderTextColor={SUBTITLE_GRAY}
              style={styles.todoTitleInput}
              returnKeyType="next"
              autoFocus
            />

            <View style={styles.todoInputRow}>
              <TextInput
                value={todoInput}
                onChangeText={setTodoInput}
                placeholder="Add a task…"
                placeholderTextColor={SUBTITLE_GRAY}
                style={styles.todoInput}
                returnKeyType="done"
                onSubmitEditing={addTodoItem}
              />
              <Pressable
                style={({ pressed }) => [styles.todoAddBtn, pressed && { opacity: 0.85 }]}
                onPress={addTodoItem}
              >
                <Ionicons name="add" size={22} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: scaleSize(8) }} showsVerticalScrollIndicator={false}>
              {todoItems.length === 0 ? (
                <Text style={styles.todoEmpty}>No tasks yet. Add one above.</Text>
              ) : (
                todoItems.map((t) => (
                  <View key={t.id} style={styles.todoRow}>
                    <Pressable
                      style={styles.todoCheck}
                      hitSlop={8}
                      onPress={() => toggleTodoItem(t.id)}
                    >
                      <View style={[styles.todoCheckbox, t.done && styles.todoCheckboxDone]}>
                        {t.done && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                      </View>
                    </Pressable>
                    <Text style={[styles.todoText, t.done && styles.todoTextDone]} numberOfLines={3}>
                      {t.text}
                    </Text>
                    <Pressable hitSlop={8} onPress={() => removeTodoItem(t.id)}>
                      <Ionicons name="close" size={18} color={SUBTITLE_GRAY} />
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Move note to folder sheet ── */}
      <Modal
        visible={moveNoteId !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setMoveNoteId(null)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setMoveNoteId(null)}>
          <Pressable
            style={[styles.sheet, { paddingBottom: insets.bottom + scaleSize(20) }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Move to folder</Text>
              <Pressable style={styles.sheetClose} hitSlop={12} onPress={() => setMoveNoteId(null)}>
                <Text style={{ fontSize: scaleFont(16), color: DEEP_BLACK }}>✕</Text>
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [styles.sheetOption, pressed && { opacity: 0.85 }]}
              onPress={() => { hapticSelect(); setShowCreateFolder(true); }}
            >
              <View style={[styles.sheetIconCircle, { backgroundColor: '#E5E7EB' }]}>
                <Ionicons name="add" size={20} color={DEEP_BLACK} />
              </View>
              <Text style={styles.sheetOptionText}>New folder</Text>
            </Pressable>

            <ScrollView style={{ maxHeight: scaleSize(360) }} showsVerticalScrollIndicator={false}>
              {folders.map((f) => (
                <Pressable
                  key={f.id}
                  style={({ pressed }) => [styles.sheetOption, pressed && { opacity: 0.85 }]}
                  onPress={() => handleAssignToFolder(f.id)}
                >
                  <View style={[styles.sheetIconCircle, { backgroundColor: '#FBE7B0' }]}>
                    <Text style={{ fontSize: scaleFont(18) }}>📁</Text>
                  </View>
                  <Text style={styles.sheetOptionText}>{f.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

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

      {/* ── First-recording full-screen overlay ── */}
      <Modal visible={showFirstRecordingOverlay} animationType="fade" presentationStyle="fullScreen">
        <FirstRecordingOverlay almostDone={overlayAlmostDone} />
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
    paddingVertical: scaleSize(16),
    paddingHorizontal: scaleSize(16),
    marginBottom: scaleSize(10),
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
    fontSize: scaleFont(13),
    color: '#8E8E93',
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
  rotatingPhraseWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: '48%',
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: scaleFont(11),
    fontWeight: '700',
    color: '#EF4444',
    letterSpacing: 1,
  },
  recordTimer: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(36),
    fontWeight: '700',
    color: DEEP_BLACK,
    letterSpacing: -1,
    marginBottom: scaleSize(16),
  },
  recordControlsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  // To-do list notepad
  todoBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  todoSheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: scaleSize(20),
  },
  todoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scaleSize(4),
  },
  todoBackBtn: {
    width: scaleSize(32),
    alignItems: 'flex-start',
  },
  todoDateText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(13),
    color: SUBTITLE_GRAY,
    textAlign: 'center',
  },
  todoTitleInput: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(26),
    fontWeight: '700',
    color: DEEP_BLACK,
    paddingVertical: scaleSize(8),
    marginBottom: scaleSize(12),
    padding: 0,
  },
  todoInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(8),
    backgroundColor: '#FFFFFF',
    borderRadius: scaleSize(14),
    paddingHorizontal: scaleSize(14),
    paddingVertical: scaleSize(10),
    marginBottom: scaleSize(12),
  },
  todoInput: {
    flex: 1,
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    color: DEEP_BLACK,
    padding: 0,
  },
  todoAddBtn: {
    width: scaleSize(36),
    height: scaleSize(36),
    borderRadius: scaleSize(18),
    backgroundColor: DEEP_BLACK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todoEmpty: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(14),
    color: SUBTITLE_GRAY,
    textAlign: 'center',
    marginTop: scaleSize(40),
  },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(12),
    backgroundColor: '#FFFFFF',
    borderRadius: scaleSize(12),
    paddingVertical: scaleSize(12),
    paddingHorizontal: scaleSize(14),
    marginBottom: scaleSize(8),
  },
  todoCheck: { padding: scaleSize(2) },
  todoCheckbox: {
    width: scaleSize(22),
    height: scaleSize(22),
    borderRadius: scaleSize(6),
    borderWidth: 2,
    borderColor: DEEP_BLACK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todoCheckboxDone: {
    backgroundColor: DEEP_BLACK,
  },
  todoText: {
    flex: 1,
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    color: DEEP_BLACK,
  },
  todoTextDone: {
    color: SUBTITLE_GRAY,
    textDecorationLine: 'line-through',
  },
});
