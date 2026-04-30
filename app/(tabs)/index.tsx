import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Image as RNImage, InteractionManager, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, Linking, Alert, ActivityIndicator, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useState, useEffect, useRef, useCallback, useMemo, useContext } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Audio } from 'expo-av';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from '@react-navigation/native';
import type { StudyMaterialSet } from '@/lib/knowledge-graph';
import { Note, getMasteryColor, noteFromStudyMaterialSet } from '@/lib/notes';
import { listAllMaterials, deleteAllLocalMaterials } from '@/lib/study-materials-storage';
import { deleteAllLocalKnowledgeGraphs } from '@/lib/knowledge-graph-storage';
import { Ionicons } from '@expo/vector-icons';
import { getStreak, recordMasteryAchieved, bumpStreak, addExtraStudyDays, getExtraStudyDays } from '@/lib/streak';
import { getOnboarding } from '@/lib/onboarding-storage';
import { useAuth } from '@/lib/auth-store';
import { sendReauthOtp, reauthenticateWithOtp } from '@/lib/auth';
import { trackPageViewed } from '@/lib/analytics';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { PaymentWarningModal } from '@/components/PaymentWarningModal';
import { schedulePaymentWarningNotifications } from '@/lib/notifications';
import { useBillingRetryCheck } from '@/lib/useBillingRetryCheck';
import * as StoreReview from 'expo-store-review';
import { getItem, setItem } from '@/lib/storage';
import { isYouTubeUrl, extractVideoId, fetchYouTubeTranscript } from '@/lib/youtube-transcript';
import LottieView from 'lottie-react-native';
import { InAppOnboardingModal } from '@/components/InAppOnboardingModal';
import {
  DEEP_BLACK,
  GRAPHITE_GRAY,
  OFF_WHITE,
  ACCENT_BLUE,
  ACCENT_BLUE_PRESSED,
  ACCENT_BLUE_TINT,
  METALLIC_SILVER,
  SUBTITLE_GRAY,
  SF_PRO,
} from '@/lib/onboarding-theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Brand accent — kept as alias for legacy naming throughout this file.
const SALMON = ACCENT_BLUE;
const SALMON_DARK = ACCENT_BLUE_PRESSED;

const SHEET_OPTIONS = [
  { id: 'record',  label: 'Record',      emoji: '🎙️', bg: '#EDE7F6' },
  { id: 'camera',  label: 'Camera',      emoji: '📷', bg: '#FFF3E0' },
  { id: 'photos',  label: 'Photos',      emoji: '🖼️', bg: '#E3F2FD' },
  { id: 'upload',  label: 'File Upload', emoji: '📄', bg: '#E0F2F1' },
  { id: 'notes',   label: 'Notes',       emoji: '🔗', bg: '#F3E5F5' },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isTablet = screenWidth > 600;
  const isLargeTablet = screenWidth > 900;
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [materials, setMaterials] = useState<StudyMaterialSet[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);

  const [streakCount, setStreakCount] = useState(0);
  const [streakPopup, setStreakPopup] = useState<number | null>(null);
  const [extraStudyDays, setExtraStudyDays] = useState<string[]>([]);
  const devBumpDoneRef = useRef(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showPaymentWarning, setShowPaymentWarning] = useState(false);
  const { signOut, deleteUser, user } = useAuth();

  useBillingRetryCheck(() => setShowPaymentWarning(true));
  const recaptchaRef = useRef<FirebaseRecaptchaVerifierModal>(null);
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthCode, setReauthCode] = useState('');
  const [reauthBusy, setReauthBusy] = useState(false);
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [reauthVerificationId, setReauthVerificationId] = useState<string | null>(null);
  const [reauthCooldown, setReauthCooldown] = useState(0);

  const firebaseConfig = useMemo(
    () => ({
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    }),
    []
  );
  const unlimitedShimmer = useSharedValue(0);
  const unlimitedScale = useSharedValue(1);
  const [savedRecordings, setSavedRecordings] = useState<{ uri: string; name: string; duration: number }[]>([]);
  const [showSavedRecordingsModal, setShowSavedRecordingsModal] = useState(false);
  const emptyArrowLottieRef = useRef<LottieView>(null);
  const [showInAppOnboarding, setShowInAppOnboarding] = useState(false);

  useEffect(() => {

    getItem('in_app_onboarding:step1').then((v) => {
      if (!v) setShowInAppOnboarding(true);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    getOnboarding().then((data) => {
      if (cancelled) return;
      if (data.user_tag === 'working-class') {
        router.replace('/professional-home');
      }
    });
    return () => { cancelled = true; };
  }, []);

  useFocusEffect(
    useCallback(() => {
      listAllMaterials().then((mats) => {
        setMaterials(mats);
        const notes = mats.map(noteFromStudyMaterialSet);
        const has75 = notes.some((n) => n.mastery >= 75);
        if (has75) {
          recordMasteryAchieved().then((newStreak) => {
            if (newStreak !== null) {
              setStreakPopup(newStreak);
              setStreakCount(newStreak);
            }
          });
        }
      });
      getStreak().then((s) => setStreakCount(s.count));
      getExtraStudyDays().then(setExtraStudyDays);
    }, [])
  );

  useEffect(() => {
    if (!__DEV__ || devBumpDoneRef.current) return;
    devBumpDoneRef.current = true;
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const dayBefore = new Date(); dayBefore.setDate(dayBefore.getDate() - 2);
    const dates = [yesterday.toISOString().slice(0, 10), dayBefore.toISOString().slice(0, 10)];
    bumpStreak(2).then(() => getStreak().then((s) => setStreakCount(s.count)));
    addExtraStudyDays(dates).then(() => setExtraStudyDays(dates));
  }, []);


  useEffect(() => {
    if (materials.length === 0) emptyArrowLottieRef.current?.play();
  }, [materials.length]);

  useEffect(() => {
    if (reauthCooldown <= 0) return;
    const t = setInterval(() => setReauthCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [reauthCooldown]);

  const weekStats = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const dow = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dow);
    const studiedDates = new Set([
      ...materials.map((m) => (m.updated_at || m.created_at)?.slice(0, 10)).filter(Boolean) as string[],
      ...extraStudyDays,
    ]);
    return ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const dStr = d.toISOString().slice(0, 10);
      return { label, isToday: dStr === todayStr, isFuture: dStr > todayStr, studied: studiedDates.has(dStr) };
    });
  }, [materials, extraStudyDays]);

  const daysStudied = useMemo(() =>
    new Set(materials.map((m) => (m.updated_at || m.created_at)?.slice(0, 10)).filter(Boolean)).size,
  [materials]);

  const cardsReviewed = useMemo(() =>
    materials.reduce((sum, m) => sum + Object.keys(m.user_answers?.flashcards ?? {}).length, 0),
  [materials]);

  const displayNotes = useMemo((): Note[] => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return materials.map(noteFromStudyMaterialSet);
    return materials
      .filter(
        (m) =>
          (m.notes?.toLowerCase().includes(q) ?? false) ||
          (m.title?.toLowerCase().includes(q) ?? false)
      )
      .map(noteFromStudyMaterialSet);
  }, [materials, searchQuery]);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const recordModalOffset = useSharedValue(1);
  const [showPlaybackModal, setShowPlaybackModal] = useState(false);
  const playbackModalOffset = useSharedValue(1);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const notesModalOffset = useSharedValue(0);
  const [notesUrl, setNotesUrl] = useState('');
  const [notesText, setNotesText] = useState('');
  const [isFetchingTranscript, setIsFetchingTranscript] = useState(false);
  const [transcriptProgress, setTranscriptProgress] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const uploadModalOffset = useSharedValue(0);
  const [uploadFiles, setUploadFiles] = useState<{ uri: string; name: string; size?: number }[]>([]);

  type ContentItem = { uri: string; name: string; size?: number; type: 'audio' | 'image' | 'file' | 'notes'; text?: string };
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [showContentConfirmModal, setShowContentConfirmModal] = useState(false);
  const contentConfirmModalOffset = useSharedValue(0);

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingMetering, setRecordingMetering] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingRecordRef = useRef(false);

  const [playbackUri, setPlaybackUri] = useState<string | null>(null);
  const [playbackDurationSec, setPlaybackDurationSec] = useState(0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playPosition, setPlayPosition] = useState(0);
  const [playDuration, setPlayDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const fabSize = isTablet ? 120 : 96;
  const fabIconSize = isTablet ? 64 : 52;
  const contentPadding = isTablet ? 40 : 20;

  useEffect(() => {
    if (!showRecordModal || !pendingRecordRef.current) return;
    const task = InteractionManager.runAfterInteractions(() => {
      pendingRecordRef.current = false;
      startRecording();
    });
    return () => task.cancel();
  }, [showRecordModal]);

  useEffect(() => {
    if (showSettingsModal) {
      unlimitedShimmer.value = 0;
      unlimitedShimmer.value = withRepeat(withTiming(1, { duration: 2500 }), -1);
    }
  }, [showSettingsModal]);

  const unlimitedBtnAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: unlimitedScale.value }],
  }));
  const unlimitedShimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: unlimitedShimmer.value * (screenWidth + 120) - 120 }],
  }));

  const handleMenuItemPress = async (itemId: string) => {
    setShowAddSheet(false);
    if (itemId === 'record') {
      pendingRecordRef.current = true;
      setShowRecordModal(true);
      requestAnimationFrame(() => {
        recordModalOffset.value = withTiming(0, {
          duration: 350,
          easing: Easing.out(Easing.cubic),
        });
      });
    }
    if (itemId === 'notes') {
      setShowNotesModal(true);
      requestAnimationFrame(() => {
        notesModalOffset.value = withTiming(1, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });
      });
    }
    if (itemId === 'camera') {
      openCameraAndSave();
    }
    if (itemId === 'photos') {
      openPhotoLibrary();
    }
    if (itemId === 'upload') {
      setShowUploadModal(true);
      requestAnimationFrame(() => {
        uploadModalOffset.value = withTiming(1, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });
      });
    }
  };

  const openPhotoLibrary = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const items: ContentItem[] = result.assets.map((a) => ({
        uri: a.uri,
        name: a.fileName ?? 'Photo',
        size: a.fileSize,
        type: 'image' as const,
      }));
      openContentConfirmModal(items);
    } catch (err) {
      console.error('Photo library failed', err);
    }
  };

  const openCameraAndSave = async () => {
    try {
      const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
      if (cameraPerm.status !== 'granted') return;
      const libPerm = await MediaLibrary.requestPermissionsAsync();
      if (libPerm.status !== 'granted') return;

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];
      await MediaLibrary.saveToLibraryAsync(asset.uri);
      openContentConfirmModal([
        { uri: asset.uri, name: asset.fileName ?? 'Photo', size: asset.fileSize, type: 'image' },
      ]);
    } catch (err) {
      console.error('Camera/save failed', err);
    }
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setRecordingDuration(0);
      setIsPaused(false);
      setRecordingMetering(null);
      activateKeepAwakeAsync();
      newRecording.setOnRecordingStatusUpdate((status) => {
        if (status.metering != null) setRecordingMetering(status.metering);
      });
      newRecording.setProgressUpdateInterval(100);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const pauseRecording = async () => {
    if (recording && !isPaused) {
      await recording.pauseAsync();
      setIsPaused(true);
      setRecordingMetering(null);
      if (timerRef.current) clearInterval(timerRef.current);
      deactivateKeepAwake();
    }
  };

  const resumeRecording = async () => {
    if (recording && isPaused) {
      await recording.startAsync();
      setIsPaused(false);
      activateKeepAwakeAsync();
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
  };

  const animatePlaybackModalIn = () => {
    requestAnimationFrame(() => {
      playbackModalOffset.value = withTiming(0, {
        duration: 350,
        easing: Easing.out(Easing.cubic),
      });
    });
  };

  const stopRecording = async () => {
    if (!recording) return;

    if (timerRef.current) clearInterval(timerRef.current);
    deactivateKeepAwake();
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    const durationSec = recordingDuration;
    setRecording(null);
    setIsPaused(false);
    setRecordingDuration(0);
    setRecordingMetering(null);
    recordModalOffset.value = withTiming(
      1,
      { duration: 300, easing: Easing.in(Easing.cubic) },
      () => {
        runOnJS(setShowRecordModal)(false);
        if (uri) {
          runOnJS(setPlaybackUri)(uri);
          runOnJS(setPlaybackDurationSec)(durationSec);
          runOnJS(setShowPlaybackModal)(true);
          runOnJS(animatePlaybackModalIn)();
        }
      }
    );
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const closeRecordModal = () => {
    if (recording) {
      recording.stopAndUnloadAsync();
      setRecording(null);
      setIsPaused(false);
      setRecordingDuration(0);
      setRecordingMetering(null);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    recordModalOffset.value = withTiming(
      1,
      { duration: 300, easing: Easing.in(Easing.cubic) },
      () => { runOnJS(setShowRecordModal)(false); }
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status?.isLoaded) {
      setPlayPosition(status.positionMillis / 1000);
      if (status.durationMillis) setPlayDuration(status.durationMillis / 1000);
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPlayPosition(0);
      }
    }
  };

  const playPlayback = async () => {
    if (sound) {
      await sound.playAsync();
      setIsPlaying(true);
    } else if (playbackUri) {
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: playbackUri },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );
      setSound(newSound);
      setPlayDuration(playbackDurationSec);
      setIsPlaying(true);
    }
  };

  const pausePlayback = async () => {
    if (sound) {
      await sound.pauseAsync();
      setIsPlaying(false);
    }
  };

  const closePlaybackModal = () => {
    if (sound) {
      sound.unloadAsync();
      setSound(null);
    }
    setPlaybackUri(null);
    setPlaybackDurationSec(0);
    setPlayPosition(0);
    setPlayDuration(0);
    setIsPlaying(false);
    playbackModalOffset.value = withTiming(
      1,
      { duration: 300, easing: Easing.in(Easing.cubic) },
      () => runOnJS(setShowPlaybackModal)(false)
    );
  };

  const formatContentSize = (size?: number, type?: string): string => {
    if (type === 'audio' && size != null) return `${Math.round(size)} sec`;
    if (size == null) return '';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const openContentConfirmModal = (items: ContentItem[]) => {
    setContentItems(items);
    setShowContentConfirmModal(true);
    requestAnimationFrame(() => {
      contentConfirmModalOffset.value = withTiming(1, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
    });
  };

  const closeContentConfirmModal = () => {
    contentConfirmModalOffset.value = withTiming(
      0,
      { duration: 250, easing: Easing.in(Easing.cubic) },
      () => {
        runOnJS(setShowContentConfirmModal)(false);
        runOnJS(setContentItems)([]);
      }
    );
  };

  const confirmPlayback = () => {
    if (!playbackUri) return;
    if (sound) sound.unloadAsync();
    setSound(null);
    setShowPlaybackModal(false);
    setPlaybackUri(null);
    openContentConfirmModal([
      { uri: playbackUri, name: 'Recording', size: playbackDurationSec, type: 'audio' },
    ]);
  };

  const playbackModalHeight = Math.max(screenHeight / (isTablet ? 4 : 3), isTablet ? 350 : 280);
  const notesModalHeight = Math.min(screenHeight * (isTablet ? 0.5 : 0.6), isTablet ? 600 : 480);
  const recordModalStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: recordModalOffset.value * screenHeight }],
  }));
  const playbackModalStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: playbackModalHeight * playbackModalOffset.value }],
  }));
  const notesModalStyle = useAnimatedStyle(() => ({
    opacity: notesModalOffset.value,
  }));

  const closeNotesModal = () => {
    notesModalOffset.value = withTiming(
      0,
      { duration: 250, easing: Easing.in(Easing.cubic) },
      () => runOnJS(setShowNotesModal)(false)
    );
  };

  const onNotesGenerate = async () => {
    let finalText = notesText;
    let finalUrl = notesUrl;
    
    // Check if URL is a YouTube link
    if (notesUrl && isYouTubeUrl(notesUrl)) {
      const videoId = extractVideoId(notesUrl);
      if (videoId) {
        setIsFetchingTranscript(true);
        try {
          const result = await fetchYouTubeTranscript(videoId, (progress) => {
            setTranscriptProgress(progress);
          });
          if (result.error) {
            Alert.alert('Transcript Error', result.error);
            setIsFetchingTranscript(false);
            setTranscriptProgress('');
            return;
          }
          if (result.text) {
            finalText = result.text;
          }
        } catch (error) {
          Alert.alert('Error', 'Failed to transcribe YouTube video. Please try again or paste the text directly.');
          setIsFetchingTranscript(false);
          setTranscriptProgress('');
          return;
        }
        setIsFetchingTranscript(false);
        setTranscriptProgress('');
      }
    }
    
    const previewLen = 28;
    const name = finalUrl
      ? 'YouTube Video'
      : (finalText.trim().replace(/\s+/g, ' ').slice(0, previewLen) || 'Content').trim();
    closeNotesModal();
    setNotesUrl('');
    setNotesText('');
    openContentConfirmModal([{ uri: finalUrl || '', name, type: 'notes', text: finalText }]);
  };

  const uploadModalHeight = Math.min(screenHeight * (isTablet ? 0.5 : 0.6), isTablet ? 600 : 480);
  const contentConfirmModalHeight = Math.min(screenHeight * (isTablet ? 0.55 : 0.65), isTablet ? 650 : 520);
  const uploadModalStyle = useAnimatedStyle(() => ({
    opacity: uploadModalOffset.value,
  }));
  const contentConfirmModalStyle = useAnimatedStyle(() => ({
    opacity: contentConfirmModalOffset.value,
  }));

  const closeUploadModal = () => {
    uploadModalOffset.value = withTiming(
      0,
      { duration: 250, easing: Easing.in(Easing.cubic) },
      () => runOnJS(setShowUploadModal)(false)
    );
    setUploadFiles([]);
  };

  const addUploadFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled) return;
      setUploadFiles((prev) => [
        ...prev,
        ...result.assets.map((a) => ({ uri: a.uri, name: a.name ?? 'file', size: a.size })),
      ]);
    } catch (err) {
      console.error('Document picker failed', err);
    }
  };

  const addUploadPhotos = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
      });
      if (result.canceled || !result.assets?.length) return;
      setUploadFiles((prev) => [
        ...prev,
        ...result.assets.map((a) => ({
          uri: a.uri,
          name: a.fileName ?? `photo-${prev.length}`,
          size: a.fileSize,
        })),
      ]);
    } catch (err) {
      console.error('Image picker failed', err);
    }
  };

  const onUploadNext = () => {
    const items: ContentItem[] = uploadFiles.map((f) => ({
      uri: f.uri,
      name: f.name,
      size: f.size,
      type: /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name) ? 'image' : 'file',
    }));
    closeUploadModal();
    openContentConfirmModal(items);
  };

  const onContentConfirmAddAnother = () => {
    closeContentConfirmModal();
    setUploadFiles(
      contentItems.map((c) => ({ uri: c.uri, name: c.name, size: c.size }))
    );
    setShowUploadModal(true);
    requestAnimationFrame(() => {
      uploadModalOffset.value = withTiming(1, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
    });
  };

  const onContentConfirmNext = async () => {
    if (__DEV__) console.log('[Studypup] Saving pending content, items:', contentItems.length, contentItems.map((c) => ({ name: c.name, type: c.type })));
    const { savePendingContent } = await import('@/lib/content-store');
    await savePendingContent(contentItems);
    if (__DEV__) console.log('[Studypup] Saved, pushing to choose-methods');
    closeContentConfirmModal();
    router.push('/choose-methods');
  };

  const removeUploadFile = (index: number) => {
    setUploadFiles((prev) => prev.filter((_, i) => i !== index));
  };


  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={[styles.header, { paddingHorizontal: contentPadding }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => setShowSearchBar((v) => !v)} style={{ marginLeft: 10 }}>
            <Image source={require('../../assets/search.png')} style={styles.headerIcon} />
          </Pressable>
        </View>
        <View style={styles.headerRight}>
          <Pressable onPress={() => setShowSettingsModal(true)}>
            <Image source={require('../../assets/settings-new.png')} style={styles.headerIcon} />
          </Pressable>
        </View>
      </View>
      <View style={styles.headerDivider} />

      {showSearchBar && (
        <View style={[styles.searchBarRow, { paddingHorizontal: contentPadding }]}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search notes..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          <Pressable
            onPress={() => {
              setShowSearchBar(false);
              setSearchQuery('');
            }}
            style={styles.searchCloseBtn}
          >
            <Text style={styles.searchCloseText}>Done</Text>
          </Pressable>
        </View>
      )}

      <ScrollView 
        style={[styles.content, { paddingHorizontal: contentPadding }]} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={true}
        alwaysBounceVertical={false}
        removeClippedSubviews={false}
        scrollEventThrottle={16}
      >
        {materials.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <View style={styles.card}>
                  <Text style={[styles.cardTitle, { fontSize: isTablet ? 28 : 20 }]}>Create Your First Study Set</Text>
                  <Text style={[styles.cardDesc, { fontSize: isTablet ? 20 : 16 }]}>
                    Transform your study materials into methods that actually work.
                  </Text>
              <Pressable style={[styles.continueBtnWrap, styles.continueBtn, { backgroundColor: '#0D0D0F' }]} onPress={() => setShowAddSheet(true)}>
                  <Text style={styles.continueBtnText}>Continue</Text>
              </Pressable>
            </View>
            <View style={styles.emptyArrowWrap}>
              <LottieView
                ref={emptyArrowLottieRef}
                source={require('../../arrow.json')}
                style={[styles.emptyArrowLottie, { transform: [{ rotate: '-90deg' }] }]}
                loop
              />
            </View>
          </View>
        ) : (
          <View style={styles.notesContainer}>
            {/* Streak / weekly stats widget */}
            <View style={styles.weekCard}>
              <View style={styles.weekCardTop}>
                <View style={styles.weekStreakRow}>
                  <Text style={styles.weekFireEmoji}>🔥</Text>
                  <Text style={styles.weekStreakNum}>{streakCount}</Text>
                  <Text style={styles.weekStreakLabel}> day streak</Text>
                </View>
                <Text style={styles.weekThisWeek}>This week</Text>
              </View>

              <View style={styles.weekDaysRow}>
                {weekStats.map(({ label, isToday, isFuture, studied }, i) => (
                  <View key={i} style={styles.weekDayCol}>
                    <Text style={styles.weekDayLabel}>{label}</Text>
                    <View style={[
                      styles.weekDayCircle,
                      studied && styles.weekDayStudied,
                      isToday && !studied && styles.weekDayToday,
                    ]}>
                      {studied && <Text style={styles.weekCheckmark}>✓</Text>}
                      {isToday && !studied && <View style={styles.weekTodayDot} />}
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.weekDivider} />

              <View style={styles.weekStatsRow}>
                <View style={styles.weekStat}>
                  <Text style={styles.weekStatNum}>{daysStudied}</Text>
                  <Text style={styles.weekStatLabel}>{daysStudied === 1 ? 'day studied' : 'days studied'}</Text>
                </View>
                <View style={styles.weekStatDivider} />
                <View style={styles.weekStat}>
                  <Text style={styles.weekStatNum}>{materials.length}</Text>
                  <Text style={styles.weekStatLabel}>{materials.length === 1 ? 'set completed' : 'sets completed'}</Text>
                </View>
                <View style={styles.weekStatDivider} />
                <View style={styles.weekStat}>
                  <Text style={[styles.weekStatNum, styles.weekStatNumBold]}>{cardsReviewed}</Text>
                  <Text style={styles.weekStatLabel}>{cardsReviewed === 1 ? 'card reviewed' : 'cards reviewed'}</Text>
                </View>
              </View>
            </View>

            <Text style={[styles.myNotesTitle, { fontSize: isTablet ? 36 : 28 }]}>My Notes</Text>
            {materials.length > 0 && displayNotes.length === 0 && (
              <Text style={styles.searchNoResults}>No notes match your search.</Text>
            )}
            {displayNotes.map((note) => (
              <Pressable
                key={note.id}
                style={[
                  styles.noteCard,
                  isTablet && {
                    alignSelf: 'center',
                    width: '100%',
                    maxWidth: Math.min(screenWidth - contentPadding * 2, 920),
                    borderRadius: 28,
                  },
                ]}
                onPress={() => router.push(`/study-set/${note.id}`)}
              >
                <View style={[styles.noteCardInner, isTablet && { padding: 28 }]}>
                  <View style={[styles.noteEmojiContainer, isTablet && { width: 100, height: 100, borderRadius: 24, marginRight: 24 }]}>
                    <Text style={[styles.noteEmoji, isTablet && { fontSize: 52 }]}>{note.emoji}</Text>
                  </View>
                  <View style={styles.noteDetails}>
                    <Text style={[styles.noteName, isTablet && { fontSize: 26, marginBottom: 8 }]}>{note.name}</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <View>
                        <Text style={[styles.noteDate, isTablet && { fontSize: 18 }]}>{note.date}</Text>
                        <Text style={[styles.noteMastery, isTablet && { fontSize: 18 }]}>Mastery: {note.mastery}%</Text>
                      </View>
                      <Pressable
                        style={[styles.viewReportBtn, isTablet && { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 24 }]}
                        onPress={(e) => { e.stopPropagation?.(); router.push(`/report?materialId=${note.id}`); }}
                        hitSlop={8}
                      >
                        <Text style={[styles.viewReportText, isTablet && { fontSize: 17 }]}>View Report</Text>
                        <RNImage source={require('../../assets/icons/arrow-right.png')} style={[styles.viewReportArrow, isTablet && { width: 18, height: 18 }]} />
                      </Pressable>
                    </View>
                    <View style={[styles.progressBarContainer, isTablet && { height: 12, borderRadius: 6 }]}>
                      <View
                        style={[
                          styles.progressBar,
                          {
                            width: `${note.mastery}%`,
                            backgroundColor: getMasteryColor(note.mastery),
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {!showRecordModal && !showPlaybackModal && !showNotesModal && !showUploadModal && !showContentConfirmModal && (
        <View style={[styles.fabContainer, {
          bottom: 24 + insets.bottom,
          right: isTablet ? 40 : 24
        }]}>
          <Pressable onPress={() => setShowAddSheet(true)} style={[styles.fab, {
            width: fabSize,
            height: fabSize,
            borderRadius: fabSize / 2
          }]}>
            <Image source={require('../../assets/plus-circle.png')} style={[styles.fabIcon, {
              width: fabIconSize,
              height: fabIconSize
            }]} />
          </Pressable>
        </View>
      )}

      {/* ── Add Content sheet ── */}
      <Modal visible={showAddSheet} transparent animationType="slide" onRequestClose={() => setShowAddSheet(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowAddSheet(false)}>
          <Pressable style={[styles.addSheet, { paddingBottom: insets.bottom + 20 }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Upload Content</Text>
              <Pressable style={styles.sheetClose} hitSlop={12} onPress={() => setShowAddSheet(false)}>
                <Text style={{ fontSize: 15, color: DEEP_BLACK }}>✕</Text>
              </Pressable>
            </View>
            {SHEET_OPTIONS.map((opt) => (
              <Pressable
                key={opt.id}
                style={({ pressed }) => [styles.sheetOption, pressed && { opacity: 0.75 }]}
                onPress={() => handleMenuItemPress(opt.id)}
              >
                <View style={[styles.sheetIconCircle, { backgroundColor: opt.bg }]}>
                  <Text style={{ fontSize: 20 }}>{opt.emoji}</Text>
                </View>
                <Text style={styles.sheetOptionText}>{opt.label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {showRecordModal && (
        <Animated.View style={[styles.recordScreen, { paddingTop: insets.top, paddingBottom: insets.bottom + 20 }, recordModalStyle]}>
          {/* Waveform */}
          <View style={styles.recordWaveWrap}>
            {Array.from({ length: 40 }, (_, i) => {
              const norm = recordingMetering != null
                ? Math.max(0, Math.min(1, (recordingMetering + 160) / 160))
                : 0.15;
              const wave = 0.3 + 0.7 * (Math.sin(i * 0.45) * 0.5 + 0.5);
              const h = Math.max(4, Math.round(norm * wave * 60));
              return <View key={i} style={[styles.recordWaveBar, { height: h, opacity: isPaused ? 0.4 : 1 }]} />;
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
            <Pressable style={styles.recordCtrlBtn} onPress={closeRecordModal}>
              <View style={styles.recordCtrlCircle}>
                <Text style={{ fontSize: 18 }}>✕</Text>
              </View>
              <Text style={styles.recordCtrlLabel}>Cancel</Text>
            </Pressable>

            <Pressable style={styles.recordStopBtn} onPress={stopRecording}>
              <View style={styles.recordStopCircle}>
                <View style={styles.recordStopSquare} />
              </View>
            </Pressable>

            <Pressable style={styles.recordCtrlBtn} onPress={isPaused ? resumeRecording : pauseRecording}>
              <View style={styles.recordCtrlCircle}>
                <Text style={{ fontSize: 18 }}>{isPaused ? '▶' : '⏸'}</Text>
              </View>
              <Text style={styles.recordCtrlLabel}>{isPaused ? 'Resume' : 'Pause'}</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {showPlaybackModal && (
        <>
          <Pressable
            style={[
              styles.modalBackdrop,
              {
                top: 0,
                left: 0,
                right: 0,
                bottom: playbackModalHeight + insets.bottom - 30,
              },
            ]}
            onPress={closePlaybackModal}
          />
          <Animated.View
            style={[
              styles.recordModal,
              { height: playbackModalHeight, bottom: insets.bottom },
              playbackModalStyle,
            ]}
          >
            <View style={styles.recordModalInner}>
              <LinearGradient
                colors={[ACCENT_BLUE_TINT, OFF_WHITE]}
                locations={[0, 0.63]}
                style={[styles.recordModalGradient, { paddingBottom: 24 + insets.bottom }]}
              >
                <View style={styles.recordModalHandle} />
                <Text style={styles.recordModalTimer}>
                  {formatTime(playPosition)}/{formatTime(playDuration || playbackDurationSec)}
                </Text>
                <View style={styles.recordModalRow}>
                  <Image
                    source={require('../../assets/listeningpup.png')}
                    style={styles.recordModalPup}
                  />
                  <View style={styles.recordModalControls}>
                    <View style={styles.recordModalButtonsStack}>
                      <Pressable style={[styles.recordModalBtn, styles.recordModalBtnDelete]} onPress={closePlaybackModal}>
                        <Ionicons name="trash-outline" size={22} color="#333" />
                        <Text style={styles.recordModalBtnLabel}>Delete</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.recordModalBtn, styles.recordModalBtnPlay]}
                        onPress={isPlaying ? pausePlayback : playPlayback}
                      >
                        <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color="#333" />
                        <Text style={styles.recordModalBtnLabel}>{isPlaying ? 'Pause' : 'Play'}</Text>
                      </Pressable>
                      <Pressable style={[styles.recordModalBtn, styles.recordModalBtnConfirm]} onPress={confirmPlayback}>
                        <Ionicons name="checkmark-circle-outline" size={22} color="#333" />
                        <Text style={styles.recordModalBtnLabel}>Confirm</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </View>
          </Animated.View>
        </>
      )}

      {showNotesModal && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { zIndex: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
            notesModalStyle,
          ]}
          pointerEvents="box-none"
        >
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
            onPress={closeNotesModal}
          />
          <View style={[styles.notesCard, { 
            maxHeight: notesModalHeight,
            width: isTablet ? '70%' : '100%',
            maxWidth: isLargeTablet ? 600 : undefined
          }]}>
            <LinearGradient
              colors={[OFF_WHITE, ACCENT_BLUE_TINT]}
              locations={[0, 0.43]}
              style={[styles.notesCardGradient, { paddingBottom: 24 + insets.bottom }]}
            >
              <Text style={styles.notesModalTitle}>Please Paste Your Content Below</Text>
              <View style={styles.notesUrlRow}>
                <Image source={require('../../assets/fi_link.png')} style={styles.notesUrlIcon} />
                <TextInput
                  style={styles.notesUrlInput}
                  placeholder="https://youtube.com/watch?v=example"
                  placeholderTextColor="#999"
                  value={notesUrl}
                  onChangeText={setNotesUrl}
                  keyboardType="url"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.notesOrRow}>
                <View style={styles.notesOrLine} />
                <Text style={styles.notesOrText}>or</Text>
                <View style={styles.notesOrLine} />
              </View>
              <TextInput
                style={styles.notesTextInput}
                placeholder="Paste your content here..."
                placeholderTextColor="#999"
                value={notesText}
                onChangeText={setNotesText}
                multiline
                scrollEnabled
                textAlignVertical="top"
              />
              {isFetchingTranscript && transcriptProgress && (
                <Text style={styles.transcriptProgressText}>{transcriptProgress}</Text>
              )}
              <Pressable 
                style={[styles.notesGenerateBtn, isFetchingTranscript && styles.notesGenerateBtnDisabled]} 
                onPress={onNotesGenerate}
                disabled={isFetchingTranscript}
              >
                {isFetchingTranscript ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator color="#fff" />
                    <Text style={styles.loadingText}>Transcribing audio...</Text>
                  </View>
                ) : (
                  <Text style={styles.notesGenerateBtnText}>Generate</Text>
                )}
              </Pressable>
            </LinearGradient>
          </View>
        </Animated.View>
      )}

      {showUploadModal && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { zIndex: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
            uploadModalStyle,
          ]}
          pointerEvents="box-none"
        >
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
            onPress={closeUploadModal}
          />
          <View style={[styles.uploadCard, { 
            maxHeight: uploadModalHeight,
            width: isTablet ? '70%' : '100%',
            maxWidth: isLargeTablet ? 600 : undefined
          }]}>
            <View style={[styles.uploadCardInner, { paddingBottom: 24 + insets.bottom }]}>
              <Text style={styles.uploadCardTitle}>Add files, photos, or documents</Text>
              <Pressable style={styles.uploadDropZone} onPress={addUploadFiles}>
                <Text style={styles.uploadDropZoneText}>Tap to add files</Text>
              </Pressable>
              <Pressable style={styles.uploadDropZoneSecondary} onPress={addUploadPhotos}>
                <Text style={styles.uploadDropZoneText}>Add from photo library</Text>
              </Pressable>
              <ScrollView 
                style={styles.uploadFileList} 
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                bounces={true}
                showsVerticalScrollIndicator={false}
              >
                {uploadFiles.map((f, i) => (
                  <View key={`${f.uri}-${i}`} style={styles.uploadFileRow}>
                    <Text style={styles.uploadFileName} numberOfLines={1}>{f.name}</Text>
                    <Pressable onPress={() => removeUploadFile(i)} hitSlop={8}>
                      <Text style={styles.uploadFileRemove}>Remove</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
              <Pressable
                style={[styles.notesGenerateBtn, { marginTop: 16 }]}
                onPress={onUploadNext}
              >
                <Text style={styles.notesGenerateBtnText}>Next</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      )}

      {showContentConfirmModal && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { zIndex: 11, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
            contentConfirmModalStyle,
          ]}
          pointerEvents="box-none"
        >
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
            onPress={closeContentConfirmModal}
          />
          <View style={[styles.contentConfirmCard, { 
            maxHeight: contentConfirmModalHeight,
            width: isTablet ? '70%' : '100%',
            maxWidth: isLargeTablet ? 650 : undefined
          }]}>
            <View style={[styles.contentConfirmInner, { paddingBottom: 24 + insets.bottom }]}>
              <Text style={styles.contentConfirmTitle}>Please upload your file</Text>
              <Text style={styles.contentConfirmSubtitle}>
                Transform your notes into effective study methods.
              </Text>
              <ScrollView 
                style={styles.contentConfirmList} 
                nestedScrollEnabled 
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                bounces={true}
                alwaysBounceVertical={false}
              >
                {contentItems.map((item, i) => (
                  <View key={`${item.uri}-${i}`} style={styles.contentConfirmRow}>
                    <View style={styles.contentConfirmRowInner}>
                      {item.type === 'image' ? (
                        <Image source={{ uri: item.uri }} style={styles.contentConfirmThumb} />
                      ) : (
                        <View style={styles.contentConfirmIconWrap}>
                          <Text style={{ fontSize: 22 }}>📝</Text>
                        </View>
                      )}
                      <Text
                        style={styles.contentConfirmNameSize}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {item.name} - {formatContentSize(item.size, item.type) || '—'}
                      </Text>
                      <View style={styles.contentConfirmCheck}>
                        <Text style={styles.contentConfirmCheckText}>✓</Text>
                      </View>
                    </View>
                    <Text style={styles.contentConfirmReplace}>Click to Replace</Text>
                  </View>
                ))}
                <Pressable style={styles.contentConfirmAddRow} onPress={onContentConfirmAddAnother}>
                  <View style={styles.contentConfirmAddIconWrap}>
                    <Text style={styles.contentConfirmAddIcon}>+</Text>
                  </View>
                  <Text style={styles.contentConfirmAddText}>Add another file</Text>
                </Pressable>
              </ScrollView>
              <Pressable style={styles.notesGenerateBtn} onPress={onContentConfirmNext}>
                <Text style={styles.notesGenerateBtnText}>Next</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      )}

      <Modal visible={showSettingsModal} transparent animationType="slide" onRequestClose={() => setShowSettingsModal(false)}>
        <View style={styles.settingsContainer}>
          <View style={styles.settingsHeader}>
            <Text style={styles.settingsTitle}>Settings</Text>
            <Pressable onPress={() => setShowSettingsModal(false)} style={styles.settingsCloseBtn}>
              <Ionicons name="close" size={28} color="#000" />
            </Pressable>
          </View>
          <ScrollView 
            style={styles.settingsScroll} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={true}
            alwaysBounceVertical={false}
          >
            <Pressable
              style={styles.unlimitedBtnWrap}
              onPressIn={() => { unlimitedScale.value = withSpring(0.97); }}
              onPressOut={() => { unlimitedScale.value = withSpring(1); }}
              onPress={() => {
                setShowSettingsModal(false);
                router.push('/create-account');
              }}
            >
              <Animated.View style={[styles.unlimitedBtnInner, unlimitedBtnAnimatedStyle]}>
                <LinearGradient
                  colors={['#0D9488', '#14B8A6', '#EC4899']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
                <Animated.View style={[styles.unlimitedShimmerStrip, unlimitedShimmerStyle]} pointerEvents="none">
                  <LinearGradient
                    colors={['transparent', 'rgba(255,255,255,0.35)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
                <Text style={styles.unlimitedBtnText}>Get Unlimited</Text>
              </Animated.View>
            </Pressable>
            <Text style={styles.settingsSectionTitle}>For You</Text>
            <View style={styles.settingsSection}>
              <Pressable style={styles.settingsItem} onPress={async () => {
                if (await StoreReview.hasAction()) {
                  await StoreReview.requestReview();
                } else {
                  Alert.alert('Thanks!', 'We appreciate your support!');
                }
              }}>
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="star" size={24} color="#000" />
                  <Text style={styles.settingsItemText}>Give Notario 5 stars</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </Pressable>
              <Pressable style={styles.settingsItem} onPress={() => {
                Alert.alert('Invite a Friend', 'Share Notario with your friends!', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Share', onPress: () => {} }
                ]);
              }}>
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="add" size={24} color="#000" />
                  <Text style={styles.settingsItemText}>Invite a friend</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </Pressable>
              <Pressable style={styles.settingsItem} onPress={() => {
                setShowSettingsModal(false);
                router.push('/notifications');
              }}>
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="notifications" size={24} color="#000" />
                  <Text style={styles.settingsItemText}>Notifications</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </Pressable>
            </View>

            <Text style={styles.settingsSectionTitle}>Support & feedback</Text>
            <View style={styles.settingsSection}>
              <Pressable style={styles.settingsItem} onPress={() => {
                Linking.openURL('https://studystudypup.lovable.app/support');
              }}>
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="chatbox" size={24} color="#000" />
                  <Text style={styles.settingsItemText}>Help Center</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </Pressable>
            </View>

            <Text style={styles.settingsSectionTitle}>Account</Text>
            <View style={styles.settingsSection}>
              <Pressable style={styles.settingsItem} onPress={() => {
                setShowSettingsModal(false);
                setShowSavedRecordingsModal(true);
              }}>
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="mic" size={24} color="#000" />
                  <Text style={styles.settingsItemText}>Saved Recordings</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </Pressable>
              <Pressable style={styles.settingsItem} onPress={() => {
                Alert.alert('Delete All Notes', 'Remove all study materials and notes from this device? This cannot be undone.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete All', style: 'destructive', onPress: async () => {
                    await deleteAllLocalMaterials();
                    await deleteAllLocalKnowledgeGraphs();
                    setMaterials([]);
                    setShowSettingsModal(false);
                  }}
                ]);
              }}>
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="trash" size={24} color="#FF4444" />
                  <Text style={[styles.settingsItemText, { color: '#FF4444' }]}>Delete all notes</Text>
                </View>
              </Pressable>
              <Pressable style={styles.settingsItem} onPress={() => {
                Alert.alert('Restore Purchases', 'Restoring your purchases...', [{ text: 'OK' }]);
              }}>
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="key" size={24} color="#000" />
                  <Text style={styles.settingsItemText}>Restore Purchases</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </Pressable>
              <Pressable style={styles.settingsItem} onPress={() => {
                Linking.openURL('https://studystudypup.lovable.app/terms');
              }}>
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="lock-closed" size={24} color="#000" />
                  <Text style={styles.settingsItemText}>Terms of Service</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </Pressable>
              <Pressable style={styles.settingsItem} onPress={() => {
                Linking.openURL('https://studystudypup.lovable.app/privacy');
              }}>
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="shield-checkmark" size={24} color="#000" />
                  <Text style={styles.settingsItemText}>Privacy Policy</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </Pressable>
              <Pressable style={styles.settingsItem} onPress={() => {
                Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign Out', style: 'destructive', onPress: async () => {
                    try {
                      await signOut();
                      router.replace('/');
                    } catch (error) {
                      console.error('Sign out error:', error);
                      Alert.alert('Error', 'Failed to sign out. Please try again.');
                    }
                  }}
                ]);
              }}>
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="power" size={24} color="#FF4444" />
                  <Text style={[styles.settingsItemText, { color: '#FF4444' }]}>Sign out</Text>
                </View>
              </Pressable>
              <Pressable style={styles.settingsItem} onPress={() => {
                Alert.alert('Delete Account', 'This action cannot be undone. All your data will be permanently deleted.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                      await deleteUser();
                      setShowSettingsModal(false);
                      router.replace('/');
                    } catch (e: any) {
                      if (e?.code === 'auth/requires-recent-login' && user?.phoneNumber && user?.providerData?.some((p) => p.providerId === 'phone')) {
                        setShowReauthModal(true);
                        setReauthVerificationId(null);
                        setReauthCode('');
                        setReauthError(null);
                      } else {
                        Alert.alert('Error', 'Could not delete account. Try signing out and back in, then try again.');
                      }
                    }
                  }}
                ]);
              }}>
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="warning" size={24} color="#FF4444" />
                  <Text style={[styles.settingsItemText, { color: '#FF4444' }]}>Delete account</Text>
                </View>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showReauthModal} transparent animationType="slide" onRequestClose={() => setShowReauthModal(false)}>
        <View style={styles.settingsContainer}>
          <View style={styles.settingsHeader}>
            <Pressable onPress={() => setShowReauthModal(false)} style={{ padding: 8 }}>
              <Ionicons name="arrow-back" size={24} color="#000" />
            </Pressable>
            <Text style={styles.settingsTitle}>Verify identity</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={{ padding: 24, flex: 1 }}>
            <Text style={{ fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#333', marginBottom: 16 }}>
              For security, enter the code sent to {user?.phoneNumber ?? ''}
            </Text>
            {reauthVerificationId === null ? (
              <Pressable
                style={[styles.continueBtn, { backgroundColor: SALMON }, (reauthBusy || reauthCooldown > 0) && { opacity: 0.6 }]}
                onPress={async () => {
                  if (!user?.phoneNumber || reauthBusy || reauthCooldown > 0) return;
                  setReauthBusy(true);
                  setReauthError(null);
                  try {
                    const vid = await sendReauthOtp(user.phoneNumber, recaptchaRef);
                    setReauthVerificationId(vid);
                    setReauthCooldown(45);
                  } catch (err: any) {
                    setReauthError(err?.message ?? 'Failed to send code.');
                  } finally {
                    setReauthBusy(false);
                  }
                }}
                disabled={reauthBusy || reauthCooldown > 0}
              >
                <Text style={styles.continueBtnText}>{reauthCooldown > 0 ? `Resend in ${reauthCooldown}s` : 'Send code'}</Text>
              </Pressable>
            ) : (
              <>
                <TextInput
                  style={styles.otpInput}
                  placeholder="Enter 6-digit code"
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                  value={reauthCode}
                  onChangeText={setReauthCode}
                  editable={!reauthBusy}
                  maxLength={6}
                />
                <Pressable
                  style={[styles.continueBtn, { backgroundColor: SALMON }, (reauthBusy || reauthCode.trim().length < 6) && { opacity: 0.6 }]}
                  onPress={async () => {
                    if (!reauthVerificationId || !user || reauthBusy || reauthCode.trim().length < 6) return;
                    setReauthBusy(true);
                    setReauthError(null);
                    try {
                      await reauthenticateWithOtp(user, reauthVerificationId, reauthCode.trim());
                      await deleteUser();
                      setShowReauthModal(false);
                      setShowSettingsModal(false);
                      router.replace('/');
                    } catch (err: any) {
                      setReauthError(err?.message ?? 'Invalid code. Try again.');
                    } finally {
                      setReauthBusy(false);
                    }
                  }}
                  disabled={reauthBusy || reauthCode.trim().length < 6}
                >
                  <Text style={styles.continueBtnText}>{reauthBusy ? 'Verifying…' : 'Verify & delete'}</Text>
                </Pressable>
              </>
            )}
            {reauthError ? <Text style={{ color: '#FF4444', marginTop: 12, fontFamily: 'Fredoka_400Regular' }}>{reauthError}</Text> : null}
          </View>
          <FirebaseRecaptchaVerifierModal ref={recaptchaRef} firebaseConfig={firebaseConfig as any} attemptInvisibleVerification />
        </View>
      </Modal>

      <Modal visible={showSavedRecordingsModal} transparent animationType="slide" onRequestClose={() => setShowSavedRecordingsModal(false)}>
        <View style={styles.settingsContainer}>
          <View style={styles.settingsHeader}>
            <Pressable onPress={() => setShowSavedRecordingsModal(false)} style={{ padding: 8 }}>
              <Ionicons name="arrow-back" size={24} color="#000" />
            </Pressable>
            <Text style={styles.settingsTitle}>Saved Recordings</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView style={styles.settingsScroll} showsVerticalScrollIndicator={false}>
            {savedRecordings.length === 0 ? (
              <View style={styles.emptyRecordingsContainer}>
                <Ionicons name="mic-off" size={64} color="#999" />
                <Text style={styles.emptyRecordingsText}>No saved recordings yet</Text>
                <Text style={styles.emptyRecordingsSubtext}>Your recordings will appear here</Text>
              </View>
            ) : (
              savedRecordings.map((recording, index) => (
                <View key={index} style={styles.recordingItem}>
                  <View style={styles.recordingItemLeft}>
                    <Ionicons name="mic" size={24} color="#FD8A8A" />
                    <View style={styles.recordingItemInfo}>
                      <Text style={styles.recordingItemName}>{recording.name}</Text>
                      <Text style={styles.recordingItemDuration}>{formatTime(recording.duration)}</Text>
                    </View>
                  </View>
                  <Pressable onPress={() => {
                    Alert.alert('Delete Recording', 'Are you sure you want to delete this recording?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => {
                        setSavedRecordings(prev => prev.filter((_, i) => i !== index));
                      }}
                    ]);
                  }}>
                    <Ionicons name="trash" size={20} color="#FF4444" />
                  </Pressable>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      <PaymentWarningModal
        visible={showPaymentWarning}
        onRenew={() => { setShowPaymentWarning(false); Linking.openURL('https://apps.apple.com/account/subscriptions'); }}
        onDismiss={() => setShowPaymentWarning(false)}
      />

      <Modal visible={streakPopup !== null} transparent animationType="fade" onRequestClose={() => setStreakPopup(null)}>
        <Pressable style={styles.streakOverlay} onPress={() => setStreakPopup(null)}>
          <View style={styles.streakCard}>
            <Image source={require('../../assets/firestreakicon.png')} style={styles.streakPopupIcon} />
            <Text style={styles.streakPopupNum}>{streakPopup}</Text>
            <Text style={styles.streakPopupLabel}>days streak</Text>
            <Text style={styles.streakPopupMsg}>
              you're on fire! 🔥 – keep it up and you're gonna be at a 4.0 GPA
            </Text>
            <Pressable style={styles.streakPopupBtn} onPress={() => setStreakPopup(null)}>
              <Text style={styles.streakPopupBtnText}>Keep Going</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <InAppOnboardingModal
        visible={showInAppOnboarding}
        onContinue={() => {
          setShowInAppOnboarding(false);
          setItem('in_app_onboarding:step1', 'shown');
        }}
      />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: OFF_WHITE },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  headerDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.12)', marginBottom: 8 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', marginLeft: 12 },
  streakIcon: { width: 24, height: 24 },
  streakNum: { fontFamily: 'Fredoka_400Regular', fontSize: 20, marginLeft: 4, marginTop: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', gap: 16 },
  headerIcon: { width: 24, height: 24 },
  searchBarRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8, backgroundColor: OFF_WHITE },
  searchInput: { flex: 1, height: 40, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, fontSize: 16 },
  searchCloseBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  searchCloseText: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#333' },
  searchNoResults: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#666', marginBottom: 12 },
  content: { flex: 1 },
  emptyStateContainer: { paddingTop: 20 },
  emptyArrowWrap: { alignItems: 'center', marginTop: 8 },
  emptyArrowLottie: { width: 80, height: 80 },
  notesContainer: { paddingTop: 12, paddingBottom: 140, flexDirection: 'column' },
  weekCard: {
    backgroundColor: DEEP_BLACK,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  weekCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  weekStreakRow: { flexDirection: 'row', alignItems: 'center' },
  weekFireEmoji: { fontSize: 20 },
  weekStreakNum: { fontFamily: 'FredokaOne_400Regular', fontSize: 22, color: '#fff', marginLeft: 6 },
  weekStreakLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#aaa', marginTop: 2 },
  weekThisWeek: { fontFamily: 'Fredoka_400Regular', fontSize: 15, color: '#aaa' },
  weekDaysRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  weekDayCol: { alignItems: 'center', gap: 6 },
  weekDayLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 13, color: '#888' },
  weekDayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GRAPHITE_GRAY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDayStudied: { backgroundColor: ACCENT_BLUE },
  weekDayToday: { backgroundColor: ACCENT_BLUE, borderWidth: 2, borderColor: ACCENT_BLUE },
  weekCheckmark: { color: '#fff', fontSize: 16, fontWeight: '700' },
  weekMissedX: { color: '#e07070', fontSize: 14, fontWeight: '700' },
  weekTodayDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  weekDivider: { height: 1, backgroundColor: GRAPHITE_GRAY, marginBottom: 14 },
  weekStatsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  weekStat: { alignItems: 'center', flex: 1 },
  weekStatNum: { fontFamily: 'FredokaOne_400Regular', fontSize: 22, color: '#fff' },
  weekStatNumBold: { fontFamily: 'FredokaOne_400Regular' },
  weekStatLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 13, color: '#888', marginTop: 2 },
  weekStatDivider: { width: 1, height: 32, backgroundColor: GRAPHITE_GRAY },
  myNotesTitle: {
    fontFamily: 'FredokaOne_400Regular',
    fontSize: 28,
    color: '#000',
    marginBottom: 20,
  },
  noteCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.20)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  noteCardInner: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  noteEmojiContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  noteEmoji: { fontSize: 32 },
  noteDetails: { flex: 1 },
  viewReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 12,
    borderWidth: 1,
    borderColor: 'rgba(51,51,51,0.20)',
    shadowColor: '#333333',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
    gap: 4,
  },
  viewReportText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
    color: '#000',
  },
  viewReportArrow: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
  },
  noteName: {
    fontFamily: 'FredokaOne_400Regular',
    fontSize: 18,
    color: '#000',
    marginBottom: 4,
  },
  noteDate: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  noteMastery: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    color: '#000',
    marginTop: 4,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  card: {
    backgroundColor: ACCENT_BLUE,
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 2,
    borderColor: ACCENT_BLUE_PRESSED,
  },
  cardTitle: { fontFamily: 'FredokaOne_400Regular', fontSize: 20, color: '#fff', marginBottom: 12, alignSelf: 'center' },
  cardDesc: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: 'rgba(255,255,255,0.9)', marginBottom: 24, alignSelf: 'center', textAlign: 'center' },
  continueBtnWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  continueBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: 18, color: '#fff' },
  otpInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    marginBottom: 16,
  },
  smallCardsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  smallCard: {
    flex: 1,
    backgroundColor: SALMON,
    borderRadius: 20,
    padding: 10,
    alignItems: 'center',
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  smallCardInner: {
    flex: 1,
    width: '100%',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  smallCardIcon: {
    width: 48,
    height: 48,
    marginBottom: 0,
  },
  smallCardValue: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 24,
    color: '#000',
    marginBottom: 4,
  },
  smallCardLabel: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    color: '#000',
    marginTop: -8,
  },
  fabContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    marginBottom: -60,
    marginRight: -20,
  },
  fabIcon: {},
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  addSheet: {
    backgroundColor: OFF_WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: SF_PRO,
    fontSize: 22,
    fontWeight: '700' as const,
    color: DEEP_BLACK,
  },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sheetIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOptionText: {
    fontFamily: SF_PRO,
    fontSize: 16,
    fontWeight: '600' as const,
    color: DEEP_BLACK,
  },
  modalBackdrop: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 9,
  },
  recordScreen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  recordWaveWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 80,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  recordWaveBar: {
    flex: 1,
    backgroundColor: ACCENT_BLUE,
    borderRadius: 2,
  },
  recordStatusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  recordDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  recordStatusText: {
    fontFamily: SF_PRO,
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#EF4444',
    letterSpacing: 1,
  },
  recordTimer: {
    fontFamily: SF_PRO,
    fontSize: 52,
    fontWeight: '700' as const,
    color: DEEP_BLACK,
    letterSpacing: -1,
    marginBottom: 48,
  },
  recordControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 40,
    marginBottom: 20,
  },
  recordCtrlBtn: { alignItems: 'center', gap: 8 },
  recordCtrlCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F2F2F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordCtrlLabel: {
    fontFamily: SF_PRO,
    fontSize: 13,
    color: DEEP_BLACK,
  },
  recordStopBtn: { alignItems: 'center' },
  recordStopCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordStopSquare: {
    width: 26,
    height: 26,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  // ── Playback modal (reuses recordModal* names) ──
  recordModal: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    zIndex: 10,
  },
  recordModalInner: { flex: 1, borderRadius: 24, overflow: 'hidden' },
  recordModalGradient: { flex: 1, paddingTop: 12, paddingHorizontal: 24, paddingBottom: 24 },
  recordModalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.2)', alignSelf: 'center' },
  recordModalTimer: { fontFamily: SF_PRO, fontSize: 18, color: '#333', marginTop: 8, textAlign: 'center' },
  recordModalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
  recordModalPup: { width: 120, height: 120, left: -20, top: 50 },
  recordModalControls: { alignItems: 'center', justifyContent: 'center', top: 50 },
  recordModalButtonsStack: { flexDirection: 'column', alignItems: 'stretch', justifyContent: 'center', gap: 16, minWidth: 140, paddingTop: 40 },
  recordModalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 20, borderRadius: 16, minWidth: 120 },
  recordModalBtnDelete: { backgroundColor: '#FF9B9B' },
  recordModalBtnPlay: { backgroundColor: '#9CA3AF' },
  recordModalBtnConfirm: { backgroundColor: '#86EFAC' },
  recordModalBtnLabel: { fontFamily: SF_PRO, fontSize: 14, color: '#333' },
  notesCard: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  notesCardGradient: {
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  notesModalTitle: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  notesUrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    gap: 10,
  },
  notesUrlIcon: { width: 20, height: 20, opacity: 0.6 },
  notesUrlInput: {
    flex: 1,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: '#333',
    paddingVertical: 14,
  },
  notesOrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  notesOrLine: { flex: 1, height: 1, backgroundColor: '#ccc' },
  notesOrText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    color: '#999',
  },
  notesTextInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: '#333',
    height: 160,
    maxHeight: 160,
    marginBottom: 20,
  },
  notesGenerateBtn: {
    backgroundColor: ACCENT_BLUE,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  notesGenerateBtnText: {
    fontFamily: SF_PRO,
    fontWeight: '600' as const,
    fontSize: 17,
    color: '#fff',
    letterSpacing: -0.2,
  },
  notesGenerateBtnDisabled: {
    opacity: 0.6,
  },
  transcriptProgressText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: '#fff',
  },
  uploadCard: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#F2E4E4',
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  uploadCardInner: {
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  uploadCardTitle: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  uploadDropZone: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#ccc',
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  uploadDropZoneSecondary: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadDropZoneText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: '#555',
  },
  uploadFileList: { maxHeight: 160 },
  uploadFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  uploadFileName: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  uploadFileRemove: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    color: SALMON,
  },
  contentConfirmCard: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: OFF_WHITE,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  contentConfirmInner: {
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  contentConfirmTitle: {
    fontFamily: SF_PRO,
    fontWeight: '700' as const,
    fontSize: 20,
    color: DEEP_BLACK,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  contentConfirmSubtitle: {
    fontFamily: SF_PRO,
    fontSize: 14,
    color: SUBTITLE_GRAY,
    textAlign: 'center',
    marginBottom: 20,
  },
  contentConfirmList: { maxHeight: 280, marginBottom: 16 },
  contentConfirmRow: { marginBottom: 16 },
  contentConfirmRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.10)',
  },
  contentConfirmThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginRight: 12,
  },
  contentConfirmIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: ACCENT_BLUE_TINT,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contentConfirmIcon: { width: 24, height: 24, opacity: 0.7 },
  contentConfirmNameSize: {
    flex: 1,
    fontFamily: SF_PRO,
    fontSize: 14,
    color: DEEP_BLACK,
    minWidth: 0,
  },
  contentConfirmCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    marginRight: 16,
  },
  contentConfirmCheckText: { color: '#fff', fontSize: 16, fontWeight: '600' as const },
  contentConfirmReplace: {
    textAlign: 'center',
    marginRight: 56,
    fontFamily: SF_PRO,
    fontSize: 12,
    color: SUBTITLE_GRAY,
    marginTop: 8,
    marginLeft: 56,
  },
  contentConfirmAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    borderStyle: 'dashed',
  },
  contentConfirmAddIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.20)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contentConfirmAddIcon: { fontSize: 22, color: DEEP_BLACK },
  contentConfirmAddText: {
    fontFamily: SF_PRO,
    fontWeight: '600' as const,
    fontSize: 16,
    color: DEEP_BLACK,
  },
  streakOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 28,
    paddingVertical: 40,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '85%',
    shadowColor: ACCENT_BLUE,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  streakPopupIcon: { width: 80, height: 80, marginBottom: 12 },
  streakPopupNum: {
    fontFamily: 'FredokaOne_400Regular',
    fontSize: 64,
    color: ACCENT_BLUE,
  },
  streakPopupLabel: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 22,
    color: ACCENT_BLUE,
    marginBottom: 20,
  },
  streakPopupMsg: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  streakPopupBtn: {
    backgroundColor: ACCENT_BLUE,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  streakPopupBtnText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 18,
    color: '#fff',
  },
  settingsContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingTop: 60,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#F5F5F5',
  },
  settingsTitle: {
    fontFamily: 'FredokaOne_400Regular',
    fontSize: 24,
    color: '#000',
    flex: 1,
    textAlign: 'center',
  },
  settingsCloseBtn: {
    padding: 4,
  },
  settingsScroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  unlimitedBtnWrap: {
    marginTop: 2,
    marginBottom: 4,
    borderRadius: 16,
    overflow: 'hidden',
  },
  unlimitedBtnInner: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  unlimitedShimmerStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 120,
  },
  unlimitedBtnText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 18,
    color: '#fff',
  },
  settingsSectionTitle: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: '#666',
    marginTop: 24,
    marginBottom: 12,
    marginLeft: 4,
  },
  settingsSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsItemText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: '#000',
  },
  emptyRecordingsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyRecordingsText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 18,
    color: '#666',
    marginTop: 16,
  },
  emptyRecordingsSubtext: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  recordingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  recordingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  recordingItemInfo: {
    flex: 1,
  },
  recordingItemName: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: '#000',
    marginBottom: 4,
  },
  recordingItemDuration: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    color: '#666',
  },
});
