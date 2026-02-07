import { noteStyles, parseMarkdown } from '@/lib/notes-renderer';
import { getMaterials } from '@/lib/study-materials-storage';
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
  { id: 'tutor', label: 'Tutor', icon: require('../../assets/icons/teachericon.png') },
];

export default function StudySetScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('📚');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(!!id);

  const load = useCallback(async () => {
    if (!id) return;
    const m = await getMaterials(id);
    if (m) {
      setTitle(m.title ?? 'Study Set');
      setEmoji(m.emoji ?? '📚');
      setDate(new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
      setNotes(m.notes ?? '');
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openMethod = (methodId: string) => {
    router.push({ pathname: '/generate-quiz', params: { methods: methodId, materialId: id } });
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out StudyPup! 📚✨\n\nThe smartest way to study - create flashcards, quizzes, and more from your notes!\n\nDownload now: https://studypup.app`,
        title: 'StudyPup - Smart Study Tools',
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
            <Pressable key={m.id} style={styles.methodBtn} onPress={() => openMethod(m.id)}>
              <Image source={m.icon} style={styles.methodIcon} contentFit="contain" />
              <Text style={styles.methodLabel}>{m.label}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={styles.notesActionBtn}
          onPress={() => router.push({ pathname: '/generate-quiz', params: { methods: 'notes', materialId: id } })}
        >
          <Image source={require('../../assets/icons/notesicon.png')} style={styles.notesActionIcon} />
          <Text style={styles.notesActionLabel}>{notes.trim() ? 'Edit note' : 'Notes — Generate'}</Text>
        </Pressable>
        <View style={[noteStyles.card, styles.notesCard]}>
          {notes.trim() ? parseMarkdown(notes) : <Text style={styles.emptyNotes}>No notes yet.</Text>}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, alignItems: 'center' },
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
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },
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
    marginBottom: 28,
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
  notesActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  notesActionIcon: { width: 24, height: 24 },
  notesActionLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: PURPLE },
  notesCard: { marginTop: 0 },
  emptyNotes: { fontFamily: 'Fredoka_400Regular', fontSize: 15, color: '#888' },
});
