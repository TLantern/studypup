import { GeneratingContentScreen } from '@/components/GeneratingContentScreen';
import { getItem, setItem } from '@/lib/storage';
import { getPendingContent, type ContentItem } from '@/lib/content-store';
import { PaywallTriggerContext, PLACEMENT_GENERATE, SuperwallAvailableContext } from '@/lib/superwall';
import { contentToText } from '@/lib/content-to-text';
import { processContentAndGenerateMaterials } from '@/lib/content-processing';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, Dimensions } from 'react-native';
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

const FREE_GENERATION_USED_KEY = 'free_generation_used';

// Get screen dimensions for responsive sizing
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Responsive scaling functions
const scaleFont = (size: number) => {
  const baseWidth = 375; // iPhone X base width
  const ratio = SCREEN_WIDTH / baseWidth;
  return Math.round(size * ratio);
};

const scaleSize = (size: number) => {
  const baseWidth = 375;
  const ratio = SCREEN_WIDTH / baseWidth;
  return Math.round(size * ratio);
};

export default function ChooseMethodsScreen() {
  const insets = useSafeAreaInsets();
  const { showPaywall } = useContext(PaywallTriggerContext);
  const superwallAvailable = useContext(SuperwallAvailableContext);
  const [selected, setSelected] = useState<string[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    getPendingContent().then((items) => {
      if (__DEV__) console.log('[Studypup] ChooseMethods loaded pending content:', items.length, items.map((c) => c.name));
      if (items.length === 0) console.warn('[Studypup] No pending content on choose-methods — savePendingContent may not have run or AsyncStorage failed');
      setContentItems(items);
    });
  }, []);

  const toggle = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const canGenerate = selected.length >= 1 && contentItems.length > 0 && !isGenerating;
  if (__DEV__ && contentItems.length > 0) console.log('[Studypup] Generate button state:', { selectedCount: selected.length, contentCount: contentItems.length, isGenerating, canGenerate });

  const handleGenerate = async () => {
    console.log('[Studypup] handleGenerate called!'); // Always show this
    if (!canGenerate) {
      if (__DEV__) console.log('[Studypup] Generate button pressed but disabled:', { selectedCount: selected.length, contentCount: contentItems.length, isGenerating });
      return;
    }
    const freeUsed = await getItem(FREE_GENERATION_USED_KEY);
    console.log('[Studypup] Free generation check:', { freeUsed, superwallAvailable });
    if (freeUsed === 'true') {
      console.log('[Studypup] Free limit hit, showing paywall or create-account');
      if (superwallAvailable) {
        console.log('[Studypup] Showing Superwall paywall');
        try {
          console.log('[Studypup] PLACEMENT_GENERATE:', PLACEMENT_GENERATE);
          console.log('[Studypup] showPaywall function:', typeof showPaywall);
          await showPaywall(PLACEMENT_GENERATE);
          console.log('[Studypup] showPaywall completed');
        } catch (error) {
          console.error('[Studypup] showPaywall error:', error);
        }
      } else {
        console.log('[Studypup] Superwall not available, pushing to create-account');
        router.push('/create-account');
      }
      return;
    }
    setIsGenerating(true);
    try {
      if (__DEV__) console.log('[Studypup] handleGenerate start, contentItems:', contentItems.length, 'selected:', selected);
      const text = await contentToText(contentItems, () => {});
      if (__DEV__) console.log('[Studypup] contentToText result length:', text?.length ?? 0);
      if (!text.trim()) {
        Alert.alert('No content', 'Could not extract text from your content. Please try different files.');
        return;
      }
      const userId = (await getItem('userId')) ?? 'local_user';
      if (__DEV__) console.log('[Studypup] processContentAndGenerateMaterials start');
      const { materials } = await processContentAndGenerateMaterials(userId, text, 'lecture', {}, true, selected);
      if (__DEV__) console.log('[Studypup] materials generated, notes length:', materials.notes?.length ?? 0);
      await setItem(FREE_GENERATION_USED_KEY, 'true');
      router.push({ pathname: '/generate-quiz', params: { methods: selected.join(','), materialId: materials.id } });
    } catch (err: any) {
      if (__DEV__) console.error('[Studypup] handleGenerate error:', err);
      Alert.alert('Generation failed', err.message ?? 'Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isGenerating) {
    return (
      <View style={[styles.generatingWrap, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <GeneratingContentScreen contentTypes={selected} />
      </View>
    );
  }

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
        <Text style={styles.generateBtnText}>Generate</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  generatingWrap: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1, backgroundColor: '#F2E4E4', paddingHorizontal: SCREEN_WIDTH * 0.06 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleSize(24),
    paddingVertical: scaleSize(8),
  },
  backBtn: { padding: scaleSize(4) },
  title: {
    flex: 1,
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(22),
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
    borderRadius: scaleSize(20),
    paddingVertical: scaleSize(10),
    paddingHorizontal: scaleSize(16),
    marginRight: SCREEN_WIDTH * 0.4,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  addBtnText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(16),
    color: '#333',
  },
  list: { flex: 1 },
  listContent: { paddingBottom: 24 },
  methodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: scaleSize(16),
    paddingVertical: scaleSize(16),
    paddingHorizontal: scaleSize(20),
    marginBottom: scaleSize(12),
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    gap: scaleSize(16),
    minHeight: scaleSize(60),
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
    fontSize: scaleFont(18),
    color: '#333',
  },
  generateBtnDisabled: { opacity: 0.5 },
  generateBtn: {
    backgroundColor: SALMON,
    borderRadius: scaleSize(16),
    paddingVertical: scaleSize(16),
    paddingHorizontal: scaleSize(20),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scaleSize(16),
    minHeight: scaleSize(56),
  },
  generateBtnText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(18),
    color: '#fff',
  },
});
