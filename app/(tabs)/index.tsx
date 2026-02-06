import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { InteractionManager, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, Linking, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  Easing,
  ReduceMotion,
  runOnJS,
} from 'react-native-reanimated';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from '@react-navigation/native';
import type { StudyMaterialSet } from '@/lib/knowledge-graph';
import { Note, getMasteryColor, noteFromStudyMaterialSet } from '@/lib/notes';
import { listAllMaterials } from '@/lib/study-materials-storage';
import { Ionicons } from '@expo/vector-icons';
import { getStreak, recordMasteryAchieved } from '@/lib/streak';
import * as StoreReview from 'expo-store-review';
import { isYouTubeUrl, extractVideoId, fetchYouTubeTranscript } from '@/lib/youtube-transcript';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SALMON = '#FD8A8A';
const SALMON_DARK = '#CA6E6E';

const MENU_ITEMS = [
  { id: 'record', label: 'Record', icon: require('../../assets/u_microphone.png') },
  { id: 'camera', label: 'Camera', icon: require('../../assets/fi_camera.png') },
  { id: 'photos', label: 'Photos', icon: require('../../assets/u_image-v.png') },
  { id: 'upload', label: 'File Upload', icon: require('../../assets/u_file-upload-alt.png') },
  { id: 'notes', label: 'Notes', icon: require('../../assets/fi_link.png') },
];

const SPRING_CONFIG = {
  stiffness: 900,
  damping: 90,
  mass: 4,
  overshootClamping: undefined,
  energyThreshold: 6e-9,
  velocity: 0,
  reduceMotion: ReduceMotion.Never,
};

const OFFSET = 72;

const MenuItem = ({
  item,
  isExpanded,
  index,
  onPress,
}: {
  item: typeof MENU_ITEMS[0];
  isExpanded: any;
  index: number;
  onPress?: (itemId: string) => void;
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    const moveValue = isExpanded.value ? OFFSET * index : 0;
    const translateValue = withSpring(-moveValue, SPRING_CONFIG);
    const delay = index * 100;
    const scaleValue = isExpanded.value ? 1 : 0;

    return {
      transform: [
        { translateY: translateValue },
        { scale: withDelay(delay, withTiming(scaleValue)) },
      ],
    };
  });

  return (
    <AnimatedPressable
      style={[animatedStyle, styles.menuItem]}
      onPress={() => onPress?.(item.id)}
    >
      <View style={styles.menuIconWrapper}>
        <Image source={item.icon} style={styles.menuIcon} />
      </View>
      <Text style={styles.menuLabel}>{item.label}</Text>
    </AnimatedPressable>
  );
};

const OVERLAY_ANIM_DURATION = 450;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isExpanded = useSharedValue(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [materials, setMaterials] = useState<StudyMaterialSet[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);

  const [streakCount, setStreakCount] = useState(0);
  const [streakPopup, setStreakPopup] = useState<number | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [savedRecordings, setSavedRecordings] = useState<{ uri: string; name: string; duration: number }[]>([]);
  const [showSavedRecordingsModal, setShowSavedRecordingsModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      listAllMaterials().then((mats) => {
        setMaterials(mats);
        // Check if any set just crossed 75% mastery today
        const notes = mats.map(noteFromStudyMaterialSet);
        const has75 = notes.some((n) => n.mastery >= 75);
        if (has75) {
          recordMasteryAchieved().then((newStreak) => {
            if (newStreak !== null) setStreakPopup(newStreak);
          });
        }
      });
      getStreak().then((s) => setStreakCount(s.count));
    }, [])
  );

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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingRecordRef = useRef(false);

  const [playbackUri, setPlaybackUri] = useState<string | null>(null);
  const [playbackDurationSec, setPlaybackDurationSec] = useState(0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playPosition, setPlayPosition] = useState(0);
  const [playDuration, setPlayDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const overlayWidth = screenWidth;
  const overlayHeight = screenHeight;

  useEffect(() => {
    if (!showRecordModal || !pendingRecordRef.current) return;
    const task = InteractionManager.runAfterInteractions(() => {
      pendingRecordRef.current = false;
      startRecording();
    });
    return () => task.cancel();
  }, [showRecordModal]);

  const toggleMenu = () => {
    isExpanded.value = !isExpanded.value;
    setIsMenuOpen((prev) => !prev);
  };

  const closeMenu = () => {
    if (isMenuOpen) {
      isExpanded.value = false;
      setIsMenuOpen(false);
    }
  };

  const openMenu = () => {
    if (!isMenuOpen) {
      isExpanded.value = true;
      setIsMenuOpen(true);
    }
  };

  const handleMenuItemPress = async (itemId: string) => {
    if (itemId === 'record') {
      closeMenu();
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
      closeMenu();
      setShowNotesModal(true);
      requestAnimationFrame(() => {
        notesModalOffset.value = withTiming(1, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });
      });
    }
    if (itemId === 'camera') {
      closeMenu();
      openCameraAndSave();
    }
    if (itemId === 'photos') {
      closeMenu();
      openPhotoLibrary();
    }
    if (itemId === 'upload') {
      closeMenu();
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
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = async () => {
    if (recording && isPaused) {
      await recording.startAsync();
      setIsPaused(false);
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
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    const durationSec = recordingDuration;
    setRecording(null);
    setIsPaused(false);
    setRecordingDuration(0);
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

  const recordModalHeight = Math.max(screenHeight / 4, 240);
  const playbackModalHeight = Math.max(screenHeight / 3, 280);
  const notesModalHeight = Math.min(screenHeight * 0.6, 480);
  const recordModalStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: recordModalHeight * recordModalOffset.value }],
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

  const uploadModalHeight = Math.min(screenHeight * 0.6, 480);
  const contentConfirmModalHeight = Math.min(screenHeight * 0.65, 520);
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
    const { savePendingContent } = await import('@/lib/content-store');
    await savePendingContent(contentItems);
    closeContentConfirmModal();
    router.push('/choose-methods');
  };

  const removeUploadFile = (index: number) => {
    setUploadFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const fabRotationStyle = useAnimatedStyle(() => {
    const rotateValue = isExpanded.value ? '-360deg' : '0deg';
    return {
      transform: [{ rotate: withTiming(rotateValue, { duration: 400 }) }],
    };
  });

  const fabTranslateStyle = useAnimatedStyle(() => {
    const translateValue = isExpanded.value ? 150 : 0;
    return {
      transform: [{ translateX: withTiming(translateValue, { duration: 400 }) }],
    };
  });

  const overlayStyle = useAnimatedStyle(() => {
    const scale = isExpanded.value ? 1 : 0;
    const opacity = isExpanded.value ? 1 : 0;
    const timingConfig = {
      duration: OVERLAY_ANIM_DURATION,
      easing: Easing.out(Easing.cubic),
    };
    const scaleVal = withTiming(scale, timingConfig);
    const translateX = withTiming(isExpanded.value ? 0 : overlayWidth / 2, timingConfig);
    const translateY = withTiming(isExpanded.value ? 0 : overlayHeight / 2, timingConfig);

    return {
      opacity: withTiming(opacity, timingConfig),
      transform: [
        { translateX },
        { translateY },
        { scale: scaleVal },
      ],
    };
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.header}>
        <Image source={require('../../assets/puppy.png')} style={styles.avatar} />
        <View style={styles.streakBadge}>
          <Image source={require('../../assets/firestreakicon.png')} style={styles.streakIcon} />
          <Text style={styles.streakNum}>{streakCount}</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable onPress={() => setShowSearchBar((v) => !v)}>
            <Image source={require('../../assets/search.png')} style={styles.headerIcon} />
          </Pressable>
          <Pressable onPress={() => setShowSettingsModal(true)}>
            <Image source={require('../../assets/settings-new.png')} style={styles.headerIcon} />
          </Pressable>
        </View>
      </View>
      <View style={styles.headerDivider} />

      {showSearchBar && (
        <View style={styles.searchBarRow}>
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {materials.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Create Your First Study Set</Text>
              <Text style={styles.cardDesc}>
                Transform your study materials into methods that actually work.
              </Text>
              <Pressable style={styles.continueBtnWrap} onPress={openMenu}>
                <LinearGradient
                  colors={['#C4C4C4', '#AADDDD']}
                  locations={[0.41, 0.77]}
                  style={styles.continueBtn}
                >
                  <Text style={styles.continueBtnText}>Continue</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.notesContainer}>
            <Text style={styles.myNotesTitle}>My Notes</Text>
            {materials.length > 0 && displayNotes.length === 0 && (
              <Text style={styles.searchNoResults}>No notes match your search.</Text>
            )}
            {displayNotes.map((note) => (
              <Pressable key={note.id} style={styles.noteCard} onPress={() => router.push(`/study-set/${note.id}`)}>
                <View style={styles.noteCardInner}>
                  <View style={styles.noteEmojiContainer}>
                    <Text style={styles.noteEmoji}>{note.emoji}</Text>
                  </View>
                  <View style={styles.noteDetails}>
                    <Text style={styles.noteName}>{note.name}</Text>
                    <Text style={styles.noteDate}>{note.date}</Text>
                    <Text style={styles.noteMastery}>Mastery: {note.mastery}%</Text>
                    <View style={styles.progressBarContainer}>
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
                  <Ionicons name="chevron-forward" size={22} color="#999" style={styles.noteChevron} />
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <Animated.View
        style={[
          styles.overlay,
          overlayStyle,
          {
            position: 'absolute',
            right: -10,
            bottom: 0,
            width: overlayWidth + 50,
            height: overlayHeight + 50,
          },
        ]}
        pointerEvents={isMenuOpen ? 'auto' : 'none'}
      >
        {isMenuOpen && (
          <LinearGradient
            colors={['rgba(0,0,0,0.45)', '#FFEDED']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} />
      </Animated.View>

      <View style={[styles.fabMenuContainer, { bottom: 80, right: 80 }]}>
        {MENU_ITEMS.map((item, index) => (
          <MenuItem
            key={item.id}
            item={item}
            isExpanded={isExpanded}
            index={index + 1}
            onPress={handleMenuItemPress}
          />
        ))}
      </View>

      {!showRecordModal && !showPlaybackModal && !showNotesModal && !showUploadModal && !showContentConfirmModal && (
        <View style={[styles.fabContainer, { bottom: 24 + insets.bottom, right: 24 }]}>
          <Animated.View style={[fabRotationStyle, fabTranslateStyle]}>
            <AnimatedPressable onPress={toggleMenu} style={styles.fab}>
              <Image source={require('../../assets/plus-circle.png')} style={styles.fabIcon} />
            </AnimatedPressable>
          </Animated.View>
        </View>
      )}

      {showRecordModal && (
        <>
          <Pressable
            style={[
              styles.modalBackdrop,
              {
                top: 0,
                left: 0,
                right: 0,
                bottom: recordModalHeight + insets.bottom,
              },
            ]}
            onPress={closeRecordModal}
          />
          <Animated.View
            style={[
              styles.recordModal,
              { height: recordModalHeight, bottom: insets.bottom },
              recordModalStyle,
            ]}
          >
            <View style={styles.recordModalInner}>
              <LinearGradient
                colors={['#C4C4C4', '#AADDDD']}
                locations={[0, 0.63]}
                style={[styles.recordModalGradient, { paddingBottom: 24 + insets.bottom }]}
              >
              <View style={styles.recordModalHandle} />
              <View style={styles.recordModalRow}>
                <Image
                  source={require('../../assets/singingpup.png')}
                  style={styles.recordModalPup}
                />
                <View style={styles.recordModalControls}>
                  <View style={styles.recordModalButtonsRow}>
                    <Pressable 
                      style={styles.recordModalBtn}
                      onPress={isPaused ? resumeRecording : pauseRecording}
                    >
                      <Image 
                        source={isPaused 
                          ? require('../../assets/Play.png') 
                          : require('../../assets/pause.png')
                        } 
                        style={styles.recordModalBtnIcon} 
                      />
                      <Text style={styles.recordModalBtnLabel}>
                        {isPaused ? 'Play' : 'Pause'}
                      </Text>
                    </Pressable>
                    <Pressable style={styles.recordModalBtn} onPress={stopRecording}>
                      <Image source={require('../../assets/stop.png')} style={styles.recordModalBtnIcon} />
                      <Text style={styles.recordModalBtnLabel}>Stop</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.recordModalTimer}>{formatTime(recordingDuration)}</Text>
                </View>
              </View>
            </LinearGradient>
            </View>
          </Animated.View>
        </>
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
                bottom: playbackModalHeight + insets.bottom,
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
                colors={['#C4C4C4', '#AADDDD']}
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
                    <View style={styles.recordModalButtonsRow}>
                      <Pressable style={styles.recordModalBtn} onPress={closePlaybackModal}>
                        <Image source={require('../../assets/delete.png')} style={styles.recordModalBtnIcon} />
                        <Text style={styles.recordModalBtnLabel}>Delete</Text>
                      </Pressable>
                      <Pressable
                        style={styles.recordModalBtn}
                        onPress={isPlaying ? pausePlayback : playPlayback}
                      >
                        <Image
                          source={isPlaying ? require('../../assets/pause.png') : require('../../assets/Play.png')}
                          style={styles.recordModalBtnIcon}
                        />
                        <Text style={styles.recordModalBtnLabel}>{isPlaying ? 'Pause' : 'Play'}</Text>
                      </Pressable>
                    </View>
                    <Pressable style={styles.recordModalBtn} onPress={confirmPlayback}>
                      <Image source={require('../../assets/Confirm.png')} style={styles.recordModalBtnIcon} />
                      <Text style={styles.recordModalBtnLabel}>Confirm</Text>
                    </Pressable>
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
          <View style={[styles.notesCard, { maxHeight: notesModalHeight }]}>
            <LinearGradient
              colors={['#AADDDD', '#C4C4C4']}
              locations={[0, 0.43]}
              style={[styles.notesCardGradient, { paddingBottom: 24 + insets.bottom }]}
            >
              <Text style={styles.notesModalTitle}>Please Paste Your Content Below</Text>
              <View style={styles.notesUrlRow}>
                <Image source={require('../../assets/fi_link.png')} style={styles.notesUrlIcon} />
                <TextInput
                  style={styles.notesUrlInput}
                  placeholder="https://example.com"
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
          <View style={[styles.uploadCard, { maxHeight: uploadModalHeight }]}>
            <View style={[styles.uploadCardInner, { paddingBottom: 24 + insets.bottom }]}>
              <Text style={styles.uploadCardTitle}>Add files, photos, or documents</Text>
              <Pressable style={styles.uploadDropZone} onPress={addUploadFiles}>
                <Text style={styles.uploadDropZoneText}>Tap to add files</Text>
              </Pressable>
              <Pressable style={styles.uploadDropZoneSecondary} onPress={addUploadPhotos}>
                <Text style={styles.uploadDropZoneText}>Add from photo library</Text>
              </Pressable>
              <ScrollView style={styles.uploadFileList} nestedScrollEnabled>
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
          <View style={[styles.contentConfirmCard, { maxHeight: contentConfirmModalHeight }]}>
            <View style={[styles.contentConfirmInner, { paddingBottom: 24 + insets.bottom }]}>
              <Text style={styles.contentConfirmTitle}>Please upload your file</Text>
              <Text style={styles.contentConfirmSubtitle}>
                Transform your notes into effective study methods.
              </Text>
              <ScrollView style={styles.contentConfirmList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {contentItems.map((item, i) => (
                  <View key={`${item.uri}-${i}`} style={styles.contentConfirmRow}>
                    <View style={styles.contentConfirmRowInner}>
                      {item.type === 'image' ? (
                        <Image source={{ uri: item.uri }} style={styles.contentConfirmThumb} />
                      ) : (
                        <View style={styles.contentConfirmIconWrap}>
                          <Image source={require('../../assets/fi_link.png')} style={styles.contentConfirmIcon} />
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
          <ScrollView style={styles.settingsScroll} showsVerticalScrollIndicator={false}>
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
                  <Text style={styles.settingsItemText}>Give StudyPup 5 stars</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </Pressable>
              <Pressable style={styles.settingsItem} onPress={() => {
                Alert.alert('Invite a Friend', 'Share StudyPup with your friends!', [
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
                Linking.openURL('https://studypup.com/help');
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
                Alert.alert('Restore Purchases', 'Restoring your purchases...', [{ text: 'OK' }]);
              }}>
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="key" size={24} color="#000" />
                  <Text style={styles.settingsItemText}>Restore Purchases</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </Pressable>
              <Pressable style={styles.settingsItem} onPress={() => {
                Linking.openURL('https://studypup.com/terms');
              }}>
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="lock-closed" size={24} color="#000" />
                  <Text style={styles.settingsItemText}>Terms of Service</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </Pressable>
              <Pressable style={styles.settingsItem} onPress={() => {
                Linking.openURL('https://studypup.com/privacy');
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
                  { text: 'Sign Out', style: 'destructive', onPress: () => router.push('/login') }
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
                  { text: 'Delete', style: 'destructive', onPress: () => {
                    Alert.alert('Account Deleted', 'Your account has been deleted.');
                    router.push('/login');
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#AADDDD' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, paddingHorizontal: 20 },
  headerDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.12)', marginBottom: 8 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', marginLeft: 12 },
  streakIcon: { width: 24, height: 24 },
  streakNum: { fontFamily: 'Fredoka_400Regular', fontSize: 20, marginLeft: 4, marginTop: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', gap: 16 },
  headerIcon: { width: 24, height: 24 },
  searchBarRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8, gap: 8, backgroundColor: '#AADDDD' },
  searchInput: { flex: 1, height: 40, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, fontSize: 16 },
  searchCloseBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  searchCloseText: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#333' },
  searchNoResults: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#666', marginBottom: 12 },
  content: { flex: 1, paddingHorizontal: 20 },
  emptyStateContainer: { paddingTop: 20 },
  notesContainer: { paddingTop: 20, paddingBottom: 140, flexDirection: 'column' },
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
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
  noteChevron: { marginLeft: 8 },
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
    marginBottom: 8,
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
    backgroundColor: '#FD8A8A',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
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
  overlay: {
    position: 'absolute',
    overflow: 'hidden',
    pointerEvents: 'box-none',
    borderRadius: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  fabMenuContainer: {
    position: 'absolute',
    flexDirection: 'column',
    alignItems: 'center',
    overflow: 'visible',
  },
  fabContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    marginBottom: -60,
    marginRight: -20,
  },
  fabIcon: { width: 52, height: 52 },
  menuItem: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    minHeight: 64,
    borderRadius: 16,
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 0,
  },
  menuIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FD8A8A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIcon: {
    width: 20,
    height: 20,
  },
  menuLabel: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: 'black',
  },
  modalBackdrop: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 9,
  },
  recordModal: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    zIndex: 10,
  },
  recordModalInner: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
  },
  recordModalGradient: {
    flex: 1,
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  recordModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignSelf: 'center',
  },
  recordModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  recordModalPup: {
    width: 120,
    height: 120,
    left: -20,
    top: 50,
  },
  recordModalControls: {
    alignItems: 'center',
    justifyContent: 'center',
    top: 50,
  },
  recordModalButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    top: 50,
    gap: 20,
  },
  recordModalBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordModalBtnIcon: {
    width: 56,
    height: 56,
  },
  recordModalBtnLabel: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    color: '#333',
    marginTop: 6,
  },
  recordModalTimer: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 18,
    color: '#333',
    marginTop: 8,
    textAlign: 'center',
    top: 50,
  },
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
    backgroundColor: SALMON,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesGenerateBtnText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 18,
    color: '#fff',
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
    backgroundColor: '#FDF0F0',
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  contentConfirmInner: {
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  contentConfirmTitle: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 20,
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  contentConfirmSubtitle: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  contentConfirmList: { maxHeight: 280, marginBottom: 16 },
  contentConfirmRow: { marginBottom: 16 },
  contentConfirmRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
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
    borderRadius: 8,
    backgroundColor: '#E0E8EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contentConfirmIcon: { width: 24, height: 24, opacity: 0.7 },
  contentConfirmNameSize: {
    flex: 1,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    color: '#333',
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
  },
  contentConfirmCheckText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  contentConfirmReplace: {
    textAlign: 'center',
    marginRight: 56,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 12,
    color: '#999',
    marginTop: 10,
    marginLeft: 56,
  },
  contentConfirmAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#ccc',
    borderStyle: 'dashed',
  },
  contentConfirmAddIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#999',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contentConfirmAddIcon: { fontSize: 22, color: '#666' },
  contentConfirmAddText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: '#333',
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
    shadowColor: '#FD8A8A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  streakPopupIcon: { width: 80, height: 80, marginBottom: 12 },
  streakPopupNum: {
    fontFamily: 'FredokaOne_400Regular',
    fontSize: 64,
    color: '#FD8A8A',
  },
  streakPopupLabel: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 22,
    color: '#FD8A8A',
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
    backgroundColor: '#FD8A8A',
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
