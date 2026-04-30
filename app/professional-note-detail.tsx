import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trackPageViewed } from '@/lib/analytics';
import { hapticSelect } from '@/lib/haptics';
import { scaleFont, scaleSize } from '@/lib/responsive';
import {
  createFolder,
  deleteProNote,
  getAllFolders,
  getCurrentProNote,
  getProNoteById,
  subscribeProNotes,
  updateProNote,
  type ProFolder,
  type StoredProNote,
} from '@/lib/pro-note-store';
import { NotarioChatModal } from '@/components/NotarioChatModal';
import { ProNoteEditModal } from '@/components/ProNoteEditModal';
import { processContentAndGenerateMaterials } from '@/lib/content-processing';
import { getItem } from '@/lib/storage';
import { Audio } from 'expo-av';
import { GeneratingContentScreen } from '@/components/GeneratingContentScreen';

const BG = '#F2F2F4';
const CARD = '#FFFFFF';
const DEEP_BLACK = '#0D0D0F';
const SUBTITLE_GRAY = '#6B7280';
const ACCENT_BLUE = '#3B82F6';
const SF_PRO = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

const ACTIONS = [
  { id: 'study', label: 'Study', emoji: '📚' },
  { id: 'edit', label: 'Edit', emoji: '📝' },
  { id: 'share', label: 'Share', emoji: '📤' },
] as const;

const WAVEFORM_BARS = Array.from({ length: 50 }, (_, i) =>
  Math.max(4, Math.round(Math.abs(Math.sin(i * 0.6) * 20) + Math.random() * 10))
);

export default function ProfessionalNoteDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ title?: string; subtitle?: string; generated?: string; noteId?: string }>();
  const [chatOpen, setChatOpen] = useState(false);
  const [rating, setRating] = useState<'up' | 'down' | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [studying, setStudying] = useState(false);
  const [studyMaterialTitle, setStudyMaterialTitle] = useState<string | null>(null);
  const [, forceTick] = useState(0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folders, setFolders] = useState<ProFolder[]>(getAllFolders());

  useEffect(() => {
    return () => {
      if (sound) sound.unloadAsync().catch(() => {});
    };
  }, [sound]);

  useEffect(() => {
    trackPageViewed('professional_note_detail');
  }, []);

  useEffect(() => {
    const unsub = subscribeProNotes(() => {
      forceTick((n) => n + 1);
      setFolders(getAllFolders());
    });
    return () => { unsub(); };
  }, []);

  const note: StoredProNote | null = useMemo(() => {
    if (params.generated !== '1') return null;
    if (params.noteId) return getProNoteById(params.noteId);
    const cur = getCurrentProNote();
    return cur ? ({ ...cur, id: 'current' } as StoredProNote) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.generated, params.noteId, forceTick]);

  const title = note?.title ?? params.title ?? 'Welcome to the App!';
  const subtitle = note?.subtitle ?? params.subtitle ?? 'Discover all features today';
  const hasAudio = !!note?.audioUri;
  const hasTranscript = !!(note?.transcript && note.transcript.trim());

  const notesText = note
    ? [
        `Overview:\n${note.overview.map((b) => `• ${b.bold ? b.bold + ': ' : ''}${b.text}`).join('\n')}`,
        `Key Topics:\n${note.keyTopics.map((b) => `• ${b.bold ? b.bold + ': ' : ''}${b.text}`).join('\n')}`,
        `Action Items:\n${note.actionItems.map((a) => `• ${a}`).join('\n')}`,
        `Final Reflection: ${note.finalReflection}`,
      ].join('\n\n')
    : '';

  const handleAction = async (id: string) => {
    hapticSelect();
    if (id === 'edit') {
      if (!note) {
        Alert.alert('Cannot edit', 'This sample note is read-only. Open a note you generated to edit it.');
        return;
      }
      setEditOpen(true);
    } else if (id === 'share') {
      const text = note
        ? `${title}\n\n${subtitle}\n\n${notesText}`
        : `${title}\n\n${subtitle}`;
      try {
        await Share.share({ message: text, title });
      } catch (e) {
        console.error('Share failed', e);
      }
    } else if (id === 'study') {
      if (!note) {
        Alert.alert('Cannot study', 'Open a note you generated to study it.');
        return;
      }
      try {
        setStudyMaterialTitle(null);
        setStudying(true);
        const userId = (await getItem('userId')) ?? 'local_user';
        const text = `${note.title}\n\n${note.subtitle}\n\n${notesText}${
          note.transcript ? `\n\nFull transcript:\n${note.transcript}` : ''
        }`;
        const { materials } = await processContentAndGenerateMaterials(
          userId,
          text,
          'text',
          { source: 'pro-note', proNoteId: note.id },
          true,
          ['quiz', 'flashcards']
        );
        if (materials.title) {
          setStudyMaterialTitle(materials.title);
          await new Promise((r) => setTimeout(r, 2200));
        }
        router.push({
          pathname: '/generate-quiz',
          params: { methods: 'quiz,flashcards', materialId: materials.id },
        });
      } catch (e: any) {
        Alert.alert('Study generation failed', e?.message ?? 'Please try again.');
      } finally {
        setStudying(false);
        setStudyMaterialTitle(null);
      }
    }
  };

  const handleDeleteNote = () => {
    if (!note) return;
    Alert.alert('Delete note', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteProNote(note.id);
          router.back();
        },
      },
    ]);
  };

  const closeFolderPicker = () => {
    setFolderPickerOpen(false);
    setNewFolderMode(false);
    setNewFolderName('');
  };

  const handleAssignFolder = (folderId: string) => {
    if (!note) return;
    hapticSelect();
    updateProNote(note.id, { folderId });
    closeFolderPicker();
    router.replace({ pathname: '/professional-home', params: { openFolders: '1' } });
  };

  const handleCreateFolderAndAssign = () => {
    const name = newFolderName.trim();
    if (!name || !note) return;
    hapticSelect();
    const folder = createFolder(name);
    updateProNote(note.id, { folderId: folder.id });
    closeFolderPicker();
    router.replace({ pathname: '/professional-home', params: { openFolders: '1' } });
  };

  if (studying) {
    return (
      <View style={styles.generatingWrap}>
        <GeneratingContentScreen
          contentTypes={['quiz', 'flashcards']}
          contentName={note?.title}
          materialTitle={studyMaterialTitle}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <Ionicons name="close" size={26} color={DEEP_BLACK} />
        </Pressable>
        <Text style={styles.headerStar}>⭐</Text>
        {note ? (
          <Pressable
            hitSlop={12}
            style={styles.headerMenu}
            onPress={() => { hapticSelect(); handleDeleteNote(); }}
          >
            <Ionicons name="trash-outline" size={20} color={DEEP_BLACK} />
          </Pressable>
        ) : (
          <View style={styles.headerMenu} />
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: scaleSize(120), paddingHorizontal: scaleSize(20) }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.titleSecond}>{subtitle}</Text>

        <View style={styles.metaRow}>
          <Pressable
            style={styles.metaTag}
            onPress={() => { if (note) { hapticSelect(); setFolderPickerOpen(true); } }}
          >
            <Ionicons name="document-text-outline" size={14} color={DEEP_BLACK} />
            <Text style={styles.metaTagText}>
              {note?.folderId
                ? (folders.find((f) => f.id === note.folderId)?.name ?? 'All Notes')
                : 'All Notes'}
            </Text>
            <Ionicons name="chevron-down" size={14} color={DEEP_BLACK} />
          </Pressable>
          <Text style={styles.metaDate}>29 Apr 2026 · 00:02:01</Text>
        </View>

        {hasAudio ? (
          <View style={styles.audioCard}>
            <Pressable
              style={styles.playBtn}
              onPress={async () => {
                hapticSelect();
                if (!note?.audioUri) return;
                try {
                  if (sound) {
                    if (isPlaying) {
                      await sound.pauseAsync();
                      setIsPlaying(false);
                    } else {
                      await sound.playAsync();
                      setIsPlaying(true);
                    }
                    return;
                  }
                  await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
                  const { sound: newSound } = await Audio.Sound.createAsync(
                    { uri: note.audioUri },
                    { shouldPlay: true }
                  );
                  newSound.setOnPlaybackStatusUpdate((status) => {
                    if (status.isLoaded) {
                      setIsPlaying(status.isPlaying);
                      if (status.didJustFinish) {
                        newSound.setPositionAsync(0);
                        setIsPlaying(false);
                      }
                    }
                  });
                  setSound(newSound);
                  setIsPlaying(true);
                } catch (e: any) {
                  Alert.alert('Playback failed', e?.message ?? 'Could not play audio.');
                }
              }}
            >
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color="#FFFFFF" />
            </Pressable>
            <View style={styles.waveform}>
              {WAVEFORM_BARS.map((h, i) => (
                <View key={i} style={[styles.waveBar, { height: h }]} />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.actionsRow}>
          {ACTIONS.map((a) => {
            const isStudy = a.id === 'study';
            return (
              <Pressable
                key={a.id}
                style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.85 }]}
                onPress={() => handleAction(a.id)}
                disabled={isStudy && studying}
              >
                {isStudy && studying ? (
                  <ActivityIndicator size="small" color={DEEP_BLACK} />
                ) : (
                  <Text style={styles.actionEmoji}>{a.emoji}</Text>
                )}
                <Text style={styles.actionLabel}>{isStudy && studying ? 'Loading…' : a.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {note ? (
          <>
            <Text style={styles.h1}>{note.title}</Text>

            <Text style={styles.h2}>Overview</Text>
            {note.overview.map((b, i) => (
              <View key={i} style={styles.bullet}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>
                  {b.bold ? <Text style={styles.bold}>{b.bold}: </Text> : null}
                  {b.text}
                </Text>
              </View>
            ))}

            <Text style={styles.h2}>Key Topics Discussed</Text>
            {note.keyTopics.map((b, i) => (
              <View key={i} style={styles.bullet}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>
                  {b.bold ? <Text style={styles.bold}>{b.bold}: </Text> : null}
                  {b.text}
                </Text>
              </View>
            ))}

            <Text style={styles.h2}>Action Items</Text>
            {note.actionItems.map((item, i) => (
              <View key={i} style={styles.bullet}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}

            <View style={styles.divider} />

            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Final Reflection: </Text>
              {note.finalReflection}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.h1}>Notee App Deep Dive</Text>
            <Text style={styles.h2}>Overview</Text>

            <View style={styles.bullet}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>
                <Text style={styles.bold}>Main Focus: </Text>
                Exploration of the Notee App, an AI-powered tool designed to streamline the
                extraction of useful information from audio and video recordings, primarily for
                learning and work productivity.
              </Text>
            </View>

            <View style={styles.bullet}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>
                <Text style={styles.bold}>Core Problem Addressed: </Text>
                Manual note-taking and summarization from recordings is time-consuming and tedious;
                Notee aims to automate and simplify this process.
              </Text>
            </View>

            <Text style={styles.h2}>Key Features Discussed</Text>

            <View style={styles.bullet}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>
                <Text style={styles.bold}>Automated Summarization: </Text>
                Generates concise overviews of long recordings, saving hours of manual review.
              </Text>
            </View>

            <View style={styles.bullet}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>
                What are the specific limitations or boundaries of the free vs. premium tiers?
              </Text>
            </View>

            <Text style={styles.h2}>Action Items</Text>

            <View style={styles.bullet}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>
                Evaluate Notee App with sample recordings to assess quality and usefulness of
                summaries and study aids.
              </Text>
            </View>
            <View style={styles.bullet}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>
                Consider workflow integration for frequent users (e.g., students, professionals
                with regular meetings).
              </Text>
            </View>
            <View style={styles.bullet}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>
                Explore premium features if higher limits or advanced output is needed.
              </Text>
            </View>

            <View style={styles.divider} />

            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Final Reflection: </Text>
              Consider the amount of time currently spent on manual note extraction each week.
              Could a tool like Notee reclaim that time and reduce mental fatigue? As AI note-taking
              tools become more prevalent, weighing their value in your own processes is
              increasingly relevant.
            </Text>
          </>
        )}

        {hasTranscript ? (
          <Pressable
            style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.85 }]}
            onPress={() => { hapticSelect(); setTranscriptOpen(true); }}
          >
            <Text style={{ fontSize: scaleFont(20) }}>📝</Text>
            <Text style={styles.linkRowText}>Open Full Transcription</Text>
            <Ionicons name="chevron-forward" size={18} color={DEEP_BLACK} />
          </Pressable>
        ) : null}

        <View style={styles.rateRow}>
          <Text style={{ fontSize: scaleFont(20) }}>⭐</Text>
          <Text style={styles.rateText}>Rate this Summary</Text>
          <Pressable
            style={[styles.rateBtn, { backgroundColor: rating === 'down' ? '#FFD2D2' : '#FFE5E5' }]}
            onPress={() => {
              hapticSelect();
              setRating('down');
            }}
          >
            <Text style={{ fontSize: scaleFont(18) }}>👎</Text>
          </Pressable>
          <Pressable
            style={[styles.rateBtn, { backgroundColor: rating === 'up' ? '#D6F0C4' : '#E5F4D8' }]}
            onPress={() => {
              hapticSelect();
              setRating('up');
            }}
          >
            <Text style={{ fontSize: scaleFont(18) }}>👍</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.chatBar, { paddingBottom: insets.bottom + scaleSize(10) }]}>
        <Pressable style={styles.chatInputWrap} onPress={() => { hapticSelect(); setChatOpen(true); }}>
          <Ionicons name="sparkles" size={18} color={DEEP_BLACK} />
          <TextInput
            value=""
            placeholder="Chat with Notario"
            placeholderTextColor={SUBTITLE_GRAY}
            style={styles.chatInput}
            editable={false}
            pointerEvents="none"
          />
        </Pressable>
      </View>

      <NotarioChatModal
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
        notes={notesText}
        title={title}
      />

      {note ? (
        <ProNoteEditModal
          visible={editOpen}
          note={note}
          onClose={() => setEditOpen(false)}
          onSave={(patch) => {
            updateProNote(note.id, patch);
            setEditOpen(false);
          }}
        />
      ) : null}

      <Modal visible={transcriptOpen} transparent animationType="slide" onRequestClose={() => setTranscriptOpen(false)}>
        <View style={[styles.transcriptRoot, { paddingTop: insets.top }]}>
          <View style={styles.transcriptHeader}>
            <Pressable hitSlop={12} onPress={() => setTranscriptOpen(false)}>
              <Ionicons name="close" size={26} color={DEEP_BLACK} />
            </Pressable>
            <Text style={styles.transcriptTitle}>Transcription</Text>
            <View style={{ width: 26 }} />
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: scaleSize(20), paddingBottom: insets.bottom + scaleSize(40) }}
          >
            <Text style={styles.transcriptText}>{note?.transcript ?? ''}</Text>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={folderPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={closeFolderPicker}
      >
        <Pressable style={styles.folderOverlay} onPress={closeFolderPicker}>
          <Pressable
            style={[styles.folderSheet, { paddingBottom: insets.bottom + scaleSize(16) }]}
            onPress={() => {}}
          >
            <View style={styles.folderHandle} />
            <Text style={styles.folderSheetTitle}>Move to Folder</Text>

            {newFolderMode ? (
              <View style={styles.newFolderRow}>
                <TextInput
                  style={styles.newFolderInput}
                  placeholder="Folder name"
                  placeholderTextColor={SUBTITLE_GRAY}
                  value={newFolderName}
                  onChangeText={setNewFolderName}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleCreateFolderAndAssign}
                />
                <Pressable style={styles.newFolderConfirm} onPress={handleCreateFolderAndAssign}>
                  <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={styles.folderRow}
                onPress={() => { hapticSelect(); setNewFolderMode(true); }}
              >
                <View style={[styles.folderRowIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="folder-outline" size={18} color={ACCENT_BLUE} />
                </View>
                <Text style={styles.folderRowText}>New Folder</Text>
                <Ionicons name="add-circle-outline" size={20} color={ACCENT_BLUE} />
              </Pressable>
            )}

            {folders.length > 0 && <View style={styles.folderDivider} />}

            {folders.map((f) => (
              <Pressable
                key={f.id}
                style={styles.folderRow}
                onPress={() => handleAssignFolder(f.id)}
              >
                <View style={[styles.folderRowIcon, { backgroundColor: '#F5F3FF' }]}>
                  <Ionicons name="folder" size={18} color="#7C3AED" />
                </View>
                <Text style={styles.folderRowText}>{f.name}</Text>
                {note?.folderId === f.id && (
                  <Ionicons name="checkmark-circle" size={20} color={ACCENT_BLUE} />
                )}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  generatingWrap: { flex: 1, backgroundColor: BG },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scaleSize(20),
    paddingVertical: scaleSize(12),
  },
  headerStar: { fontSize: scaleFont(22) },
  headerMenu: {
    width: scaleSize(32),
    height: scaleSize(32),
    borderRadius: scaleSize(16),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(22),
    fontWeight: '700',
    color: DEEP_BLACK,
    letterSpacing: -0.4,
  },
  titleSecond: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(22),
    fontWeight: '700',
    color: DEEP_BLACK,
    letterSpacing: -0.4,
    marginBottom: scaleSize(12),
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(10),
    marginBottom: scaleSize(16),
  },
  metaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(4),
    backgroundColor: '#FFFFFF',
    paddingHorizontal: scaleSize(10),
    paddingVertical: scaleSize(6),
    borderRadius: scaleSize(8),
  },
  metaTagText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(13),
    fontWeight: '500',
    color: DEEP_BLACK,
  },
  metaDate: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(12),
    color: SUBTITLE_GRAY,
  },
  audioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(12),
    backgroundColor: CARD,
    borderRadius: scaleSize(14),
    padding: scaleSize(12),
    marginBottom: scaleSize(14),
  },
  playBtn: {
    width: scaleSize(36),
    height: scaleSize(36),
    borderRadius: scaleSize(10),
    backgroundColor: DEEP_BLACK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: scaleSize(28),
  },
  waveBar: {
    flex: 1,
    backgroundColor: '#9CA3AF',
    borderRadius: 1,
  },
  duration: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(12),
    color: DEEP_BLACK,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: scaleSize(10),
    marginBottom: scaleSize(20),
  },
  actionCard: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: scaleSize(14),
    paddingVertical: scaleSize(16),
    alignItems: 'center',
    gap: scaleSize(6),
  },
  actionEmoji: { fontSize: scaleFont(22) },
  actionLabel: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(13),
    fontWeight: '500',
    color: DEEP_BLACK,
  },
  h1: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(22),
    fontWeight: '700',
    color: DEEP_BLACK,
    marginTop: scaleSize(4),
    marginBottom: scaleSize(12),
  },
  h2: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(18),
    fontWeight: '700',
    color: DEEP_BLACK,
    marginTop: scaleSize(14),
    marginBottom: scaleSize(8),
  },
  bullet: {
    flexDirection: 'row',
    gap: scaleSize(8),
    marginBottom: scaleSize(10),
    paddingRight: scaleSize(4),
  },
  bulletDot: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    color: DEEP_BLACK,
    lineHeight: scaleFont(22),
  },
  bulletText: {
    flex: 1,
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    color: DEEP_BLACK,
    lineHeight: scaleFont(22),
  },
  bold: { fontWeight: '700' },
  bodyText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    color: DEEP_BLACK,
    lineHeight: scaleFont(22),
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.12)',
    marginVertical: scaleSize(16),
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(12),
    backgroundColor: CARD,
    borderRadius: scaleSize(14),
    paddingHorizontal: scaleSize(14),
    paddingVertical: scaleSize(14),
    marginTop: scaleSize(20),
  },
  linkRowText: {
    flex: 1,
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    fontWeight: '500',
    color: DEEP_BLACK,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(10),
    backgroundColor: CARD,
    borderRadius: scaleSize(14),
    paddingHorizontal: scaleSize(14),
    paddingVertical: scaleSize(12),
    marginTop: scaleSize(10),
  },
  rateText: {
    flex: 1,
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    fontWeight: '500',
    color: DEEP_BLACK,
  },
  rateBtn: {
    width: scaleSize(40),
    height: scaleSize(36),
    borderRadius: scaleSize(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: scaleSize(20),
    paddingTop: scaleSize(10),
    backgroundColor: BG,
  },
  chatInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(10),
    backgroundColor: CARD,
    borderRadius: scaleSize(18),
    paddingHorizontal: scaleSize(16),
    paddingVertical: scaleSize(14),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  chatInput: {
    flex: 1,
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    color: DEEP_BLACK,
    padding: 0,
  },
  transcriptRoot: { flex: 1, backgroundColor: BG },
  transcriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scaleSize(20),
    paddingVertical: scaleSize(12),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  transcriptTitle: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(17),
    fontWeight: '700',
    color: DEEP_BLACK,
  },
  transcriptText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    color: DEEP_BLACK,
    lineHeight: scaleFont(22),
  },
  folderOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  folderSheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: scaleSize(20),
    borderTopRightRadius: scaleSize(20),
    paddingHorizontal: scaleSize(20),
    paddingTop: scaleSize(12),
  },
  folderHandle: {
    width: scaleSize(36),
    height: scaleSize(4),
    borderRadius: scaleSize(2),
    backgroundColor: '#E5E5E7',
    alignSelf: 'center',
    marginBottom: scaleSize(16),
  },
  folderSheetTitle: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(17),
    fontWeight: '700',
    color: DEEP_BLACK,
    marginBottom: scaleSize(14),
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(12),
    paddingVertical: scaleSize(12),
  },
  folderRowIcon: {
    width: scaleSize(36),
    height: scaleSize(36),
    borderRadius: scaleSize(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderRowText: {
    flex: 1,
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    fontWeight: '500',
    color: DEEP_BLACK,
  },
  folderDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5E7',
    marginVertical: scaleSize(4),
  },
  newFolderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(10),
    paddingVertical: scaleSize(8),
  },
  newFolderInput: {
    flex: 1,
    backgroundColor: BG,
    borderRadius: scaleSize(10),
    paddingHorizontal: scaleSize(14),
    paddingVertical: scaleSize(10),
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    color: DEEP_BLACK,
  },
  newFolderConfirm: {
    width: scaleSize(40),
    height: scaleSize(40),
    borderRadius: scaleSize(10),
    backgroundColor: ACCENT_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
