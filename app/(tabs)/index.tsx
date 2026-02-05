import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { InteractionManager, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
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
  const tabBarHeight = useBottomTabBarHeight();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isExpanded = useSharedValue(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const recordModalOffset = useSharedValue(1);
  const [showPlaybackModal, setShowPlaybackModal] = useState(false);
  const playbackModalOffset = useSharedValue(1);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const notesModalOffset = useSharedValue(0);
  const [notesUrl, setNotesUrl] = useState('');
  const [notesText, setNotesText] = useState('');
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
  const overlayHeight = screenHeight - tabBarHeight;

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

  const onNotesGenerate = () => {
    const name = notesUrl ? 'Link' : 'Pasted content';
    closeNotesModal();
    const text = notesText;
    setNotesUrl('');
    setNotesText('');
    openContentConfirmModal([{ uri: notesUrl || '', name, type: 'notes', text }]);
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
        <Image source={require('../../assets/mainpup.png')} style={styles.avatar} />
        <View style={styles.streakBadge}>
          <Image source={require('../../assets/firestreakicon.png')} style={styles.streakIcon} />
          <Text style={styles.streakNum}>0</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable onPress={() => {}}>
            <Image source={require('../../assets/search.png')} style={styles.headerIcon} />
          </Pressable>
          <Pressable onPress={() => {}}>
            <Image source={require('../../assets/settings-new.png')} style={styles.headerIcon} />
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create Your First Study Set</Text>
        <Text style={styles.cardDesc}>Transform your study materials into methods that actually work.</Text>
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

      <View style={styles.smallCardsRow}>
        <View style={styles.smallCard}>
          <Image source={require('../../assets/weeklygoalicon.png')} style={styles.smallCardIcon} />
          <Text style={styles.smallCardValue}>88%</Text>
          <Text style={styles.smallCardLabel}>Weekly Goal</Text>
        </View>
        <View style={styles.smallCard}>
          <Image source={require('../../assets/firestreakicon.png')} style={styles.smallCardIcon} />
          <Text style={styles.smallCardValue}>30</Text>
          <Text style={styles.smallCardLabel}>Streak days</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Fail-Proof Study Plan</Text>
        <Pressable style={styles.continueBtnWrap}>
          <LinearGradient
            colors={['#C4C4C4', '#AADDDD']}
            locations={[0.41, 0.77]}
            style={styles.continueBtn}
          >
            <Text style={styles.continueBtnText}>Begin</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <Animated.View
        style={[
          styles.overlay,
          overlayStyle,
          {
            position: 'absolute',
            right: -10,
            bottom: tabBarHeight - 100,
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

      <View style={[styles.fabMenuContainer, { bottom: tabBarHeight - 85, right: 80 }]}>
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
        <View style={[styles.fabContainer, { bottom: tabBarHeight - 85, right: 5 }]}>
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
                bottom: recordModalHeight + tabBarHeight - 40,
              },
            ]}
            onPress={closeRecordModal}
          />
          <Animated.View
            style={[
              styles.recordModal,
              { height: recordModalHeight, bottom: tabBarHeight },
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
                bottom: playbackModalHeight + tabBarHeight - 40,
              },
            ]}
            onPress={closePlaybackModal}
          />
          <Animated.View
            style={[
              styles.recordModal,
              { height: playbackModalHeight, bottom: tabBarHeight },
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
              <Pressable style={styles.notesGenerateBtn} onPress={onNotesGenerate}>
                <Text style={styles.notesGenerateBtnText}>Generate</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#AADDDD', paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', marginLeft: 12 },
  streakIcon: { width: 24, height: 24 },
  streakNum: { fontFamily: 'Fredoka_400Regular', fontSize: 18, marginLeft: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', gap: 16 },
  headerIcon: { width: 24, height: 24 },
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
    padding: 20,
    alignItems: 'center',
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  smallCardIcon: {
    width: 48,
    height: 48,
    marginBottom: 8,
  },
  smallCardValue: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 24,
    color: '#fff',
    marginBottom: 4,
  },
  smallCardLabel: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
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
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  fabIcon: { width: 42, height: 42 },
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
});
