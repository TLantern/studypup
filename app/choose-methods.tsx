import { getItem } from '@/lib/storage';
import { getPendingContent, type ContentItem } from '@/lib/content-store';
import { contentToText } from '@/lib/content-to-text';
import { processContentAndGenerateMaterials } from '@/lib/content-processing';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PURPLE = '#7c3aed';

const METHODS = [
  { id: 'notes', label: 'Notes', icon: require('../assets/icons/notesicon.png') },
  { id: 'flashcards', label: 'Flashcards', icon: require('../assets/icons/flashcardicon.png') },
  { id: 'quiz', label: 'Quiz', icon: require('../assets/icons/quizicon.png') },
  { id: 'written', label: 'Written', icon: require('../assets/icons/pencilicon.png') },
  { id: 'fill', label: 'Fill in the blank', customIcon: '_' },
  { id: 'tutor', label: 'Tutor', icon: require('../assets/icons/teachericon.png') },
];

const SALMON = '#FD8A8A';

export default function ChooseMethodsScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');

  useEffect(() => {
    getPendingContent().then(setContentItems);
  }, []);

  const toggle = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const canGenerate = selected.length >= 1 && contentItems.length > 0 && !isGenerating;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    setProgress('Converting content...');
    try {
      const text = await contentToText(contentItems, (p) => {
        setProgress(`Processing ${p.current}/${p.total}: ${p.itemName}`);
      });
      if (!text.trim()) {
        Alert.alert('No content', 'Could not extract text from your content. Please try different files.');
        return;
      }
      setProgress('Extracting concepts...');
      const userId = (await getItem('userId')) ?? 'local_user';
      const { materials } = await processContentAndGenerateMaterials(userId, text, 'lecture', {}, true, selected);
      setProgress('');
      router.push({ pathname: '/generate-quiz', params: { methods: selected.join(','), materialId: materials.id } });
    } catch (err: any) {
      Alert.alert('Generation failed', err.message ?? 'Please try again.');
    } finally {
      setIsGenerating(false);
      setProgress('');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color="#333" />
        </Pressable>
        <Text style={styles.title}>Choose Methods</Text>
      </View>

      <View style={styles.contentRow}>
        <Image source={require('../assets/icons/contenticon.png')} style={styles.contentIcon} />
        <Text style={styles.contentLabel}>
          {contentItems.length > 0 ? `${contentItems.length} item(s)` : 'Content'}
        </Text>
        <Pressable style={styles.addBtn} onPress={() => router.back()}>
          <Text style={styles.addBtnText}>{contentItems.length > 0 ? 'Change' : '+ Add'}</Text>
        </Pressable>
      </View>
      {progress ? (
        <View style={styles.progressRow}>
          <ActivityIndicator size="small" color={PURPLE} />
          <Text style={styles.progressText}>{progress}</Text>
        </View>
      ) : null}

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {METHODS.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => toggle(m.id)}
            style={[
              styles.methodBtn,
              m.id === 'written' && styles.methodBtnFlat,
              selected.includes(m.id) && styles.methodBtnSelected,
            ]}
          >
            {'customIcon' in m && m.customIcon ? (
              <View style={styles.methodIconWrap}>
                <Text style={styles.methodCustomIcon}>{m.customIcon}</Text>
              </View>
            ) : (
              <Image source={m.icon} style={styles.methodIcon} />
            )}
            <Text style={styles.methodLabel}>{m.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable
        style={[styles.generateBtn, !canGenerate && styles.generateBtnDisabled]}
        onPress={handleGenerate}
      >
        {isGenerating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.generateBtnText}>Generate</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2E4E4', paddingHorizontal: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 8,
  },
  backBtn: { padding: 4 },
  title: {
    flex: 1,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 22,
    color: '#333',
    textAlign: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 10,
  },
  contentIcon: { width: 24, height: 24 },
  contentLabel: {
    flex: 1,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 18,
    color: '#333',
  },
  addBtn: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 150,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  addBtnText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: '#333',
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  progressText: { fontFamily: 'Fredoka_400Regular', fontSize: 14, color: '#666' },
  list: { flex: 1 },
  listContent: { paddingBottom: 24 },
  methodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    gap: 16,
  },
  methodBtnFlat: {
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  methodBtnSelected: { borderColor: PURPLE, borderWidth: 2 },
  methodIcon: { width: 28, height: 28 },
  methodIconWrap: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  methodCustomIcon: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 24,
    color: '#333',
  },
  methodLabel: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 18,
    color: '#333',
  },
  generateBtnDisabled: { opacity: 0.5 },
  generateBtn: {
    backgroundColor: SALMON,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  generateBtnText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 18,
    color: '#fff',
  },
});
