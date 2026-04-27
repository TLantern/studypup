import { noteStyles, parseMarkdown } from '@/lib/notes-renderer';
import { getMaterials } from '@/lib/study-materials-storage';
import { getKnowledgeGraph } from '@/lib/knowledge-graph-storage';
import { ChatModal } from '@/components/ChatModal';
import { VoiceChatModal } from '@/components/VoiceChatModal';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PURPLE = '#7c3aed';

const METHODS = [
  { id: 'notes', label: 'Edit note', icon: require('../../assets/icons/notesicon.png') },
  { id: 'flashcards', label: 'Flashcards', icon: require('../../assets/icons/flashcardicon.png') },
  { id: 'quiz', label: 'Quiz', icon: require('../../assets/icons/quizicon.png') },
  { id: 'written', label: 'Written', icon: require('../../assets/icons/pencilicon.png') },
  { id: 'fill', label: 'Fill in the blank', icon: require('../../assets/icons/fillicon.png') },
  { id: 'tutor', label: 'AI Avatar', subtitle: 'Your personal tutor', customIcon: '✦', isAvatar: true },
];

export default function StudySetScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('📚');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [sources, setSources] = useState<Array<{ name: string; type: string; emoji: string }>>([]);
  const [loading, setLoading] = useState(!!id);
  const [showChat, setShowChat] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [resumeMethods, setResumeMethods] = useState<string>('');

  const load = useCallback(async () => {
    if (!id) return;
    const m = await getMaterials(id);
    if (m) {
      setTitle(m.title ?? 'Study Set');
      setEmoji(m.emoji ?? '📚');
      setDate(new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
      setNotes(m.notes ?? '');
      const methodsWithData: string[] = [];
      if (m.flashcards?.length) methodsWithData.push('flashcards');
      if (m.quiz_questions?.length) methodsWithData.push('quiz');
      if (m.written_questions?.length) methodsWithData.push('written');
      if (m.fill_in_blank_questions?.length) methodsWithData.push('fill');
      if (m.notes?.trim()) methodsWithData.push('notes');
      setResumeMethods(methodsWithData.join(','));
      let srcs = m.sources ?? [];
      if (srcs.length === 0 && m.knowledge_graph_id) {
        const kg = await getKnowledgeGraph(m.knowledge_graph_id);
        if (kg?.source) {
          const typeMap: Record<string, string> = { lecture: '🎤', text: '📝', upload: '📄', manual: '✏️' };
          const nameMap: Record<string, string> = { lecture: 'Lecture Recording', text: 'Text / URL', upload: 'Uploaded File', manual: 'Manual Entry' };
          srcs = [{ name: nameMap[kg.source.type] ?? kg.source.type, type: kg.source.type as any, emoji: typeMap[kg.source.type] ?? '📄' }];
        }
      }
      setSources(srcs);
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openMethod = (methodId: string) => {
    if (methodId === 'tutor') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push({ pathname: '/avatar-tutor' as any, params: { materialId: id } });
      return;
    }
    router.push({ pathname: '/generate-quiz', params: { methods: methodId, materialId: id } });
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out Notario! 📚✨\n\nThe smartest way to study - create flashcards, quizzes, and more from your notes!\n\nDownload now: https://notario.app`,
        title: 'Notario - Smart Study Tools',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={PURPLE} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color="#333" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEmoji}>{emoji}</Text>
        </View>
        <Pressable style={styles.shareBtn} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={16} color="#333" />
          <Text style={styles.shareBtnText}>SHARE</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.date}>{date}</Text>

        <View style={styles.methodsGrid}>
          {METHODS.map((m) => (
            <Pressable
              key={m.id}
              style={[styles.methodBtn, m.isAvatar && styles.methodBtnAvatar]}
              onPress={() => openMethod(m.id)}
            >
              {m.isAvatar ? (
                <Text style={styles.avatarIcon}>{m.customIcon}</Text>
              ) : (
                <Image source={m.icon} style={styles.methodIcon} contentFit="contain" />
              )}
              <View>
                <Text style={[styles.methodLabel, m.isAvatar && styles.avatarLabel]}>{m.label}</Text>
                {m.subtitle ? <Text style={styles.avatarSubtitle}>{m.subtitle}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>

        {resumeMethods.length > 0 && (
          <Pressable
            style={styles.resumeBtn}
            onPress={() => router.push({ pathname: '/generate-quiz', params: { methods: resumeMethods, materialId: id, resume: '1' } })}
          >
            <Ionicons name="play-circle" size={20} color="#fff" />
            <Text style={styles.resumeLabel}>Resume Study Session</Text>
          </Pressable>
        )}

        <View style={styles.sourceDivider}>
          <View style={styles.sourceDividerLine} />
          <Text style={styles.sourceDividerLabel}>Source Material</Text>
          <View style={styles.sourceDividerLine} />
        </View>

        <Pressable style={styles.sourceBtn} onPress={() => router.push({ pathname: '/study-set/sources' as any, params: { materialId: id } })}>
          <Text style={styles.sourceBtnEmoji}>📝</Text>
          <Text style={styles.sourceBtnLabel}>{sources.length === 1 ? 'Source' : 'Sources'} ({sources.length})</Text>
        </Pressable>

        <View style={[noteStyles.card, styles.notesCard]}>
          {notes.trim() ? parseMarkdown(notes) : <Text style={styles.emptyNotes}>No notes yet.</Text>}
        </View>
        <Pressable
          style={styles.notesActionBtn}
          onPress={() => router.push({ pathname: '/generate-quiz', params: { methods: 'notes', materialId: id } })}
        >
          <Image source={require('../../assets/icons/notesicon.png')} style={styles.notesActionIcon} />
          <Text style={styles.notesActionLabel}>{notes.trim() ? 'Edit note' : 'Notes — Generate'}</Text>
        </Pressable>
      </ScrollView>

      <View style={[styles.stickyBar, { paddingBottom: insets.bottom + 8 }]}>
        <Pressable style={styles.stickyCard} onPress={() => setShowChat(true)}>
          <Text style={styles.stickyEmoji}>💬</Text>
          <Text style={styles.stickyLabel} numberOfLines={1}>Chat with notes</Text>
        </Pressable>
        <Pressable style={styles.stickyCard} onPress={() => setShowVoice(true)}>
          <Text style={styles.stickyEmoji}>🎙️</Text>
          <Text style={styles.stickyLabel} numberOfLines={1}>Voice chat</Text>
        </Pressable>
      </View>

      <ChatModal
        visible={showChat}
        onClose={() => setShowChat(false)}
        notes={notes}
        title={title}
      />
      <VoiceChatModal
        visible={showVoice}
        onClose={() => setShowVoice(false)}
        context={notes}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  backBtn: { padding: 4 },
  headerCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  headerEmoji: { fontSize: 28 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFC3C3',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  shareBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: 14, color: '#333' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  title: {
    fontFamily: 'FredokaOne_400Regular',
    fontSize: 24,
    color: '#000',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
  date: { fontFamily: 'Fredoka_400Regular', fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24 },
  methodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 4,
  },
  methodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eee',
    minWidth: '47%',
  },
  methodIcon: { width: 24, height: 24, marginRight: 10 },
  methodLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 15, color: PURPLE },
  methodBtnAvatar: {
    borderWidth: 1.5,
    borderColor: '#ede9fe',
    backgroundColor: '#fff',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  avatarIcon: { fontFamily: 'Fredoka_400Regular', fontSize: 18, color: '#F5A623', marginRight: 10 },
  avatarLabel: { color: PURPLE },
  avatarSubtitle: { fontFamily: 'Fredoka_400Regular', fontSize: 11, color: '#999', marginTop: 1 },
  notesActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginTop: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  notesActionIcon: { width: 24, height: 24 },
  notesActionLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: PURPLE },
  notesCard: { marginTop: 24, marginBottom: 0 },
  emptyNotes: { fontFamily: 'Fredoka_400Regular', fontSize: 15, color: '#888' },
  stickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.07)',
  },
  stickyCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#f4f4f4',
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ebebeb',
  },
  stickyEmoji: { fontSize: 17 },
  stickyLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 12, color: '#444', lineHeight: 15 },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FD8A8A',
    borderRadius: 16,
    paddingVertical: 15,
    marginTop: 12,
    marginBottom: 4,
  },
  resumeLabel: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 17,
    color: '#fff',
  },
  sourceDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 10,
    gap: 10,
  },
  sourceDividerLine: { flex: 1, height: 1, backgroundColor: '#e0e0e0' },
  sourceDividerLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 13, color: '#999' },
  sourceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f4f4f4',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: '#ebebeb',
  },
  sourceBtnEmoji: { fontSize: 20 },
  sourceBtnLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 15, color: '#555', flex: 1 },
});
