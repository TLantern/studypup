import { GeneratingContentScreen } from '@/components/GeneratingContentScreen';
import { getItem } from '@/lib/storage';
import { getPendingContent, type ContentItem } from '@/lib/content-store';
import { updateMaterials } from '@/lib/study-materials-storage';
import { trackPageViewed } from '@/lib/analytics';
import { contentToText } from '@/lib/content-to-text';
import { processContentAndGenerateMaterials } from '@/lib/content-processing';
import { scaleFont, scaleSize, RESPONSIVE } from '@/lib/responsive';
import { DEEP_BLACK, GRAPHITE_GRAY, OFF_WHITE, METALLIC_SILVER, ACCENT_BLUE } from '@/lib/onboarding-theme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PURPLE = ACCENT_BLUE;

const METHODS = [
  { id: 'notes', label: 'Notes', icon: require('../assets/icons/notesicon.png') },
  { id: 'flashcards', label: 'Flashcards', icon: require('../assets/icons/flashcardicon.png') },
  { id: 'quiz', label: 'Quiz', icon: require('../assets/icons/quizicon.png') },
  { id: 'written', label: 'Written', icon: require('../assets/icons/pencilicon.png') },
  { id: 'fill', label: 'Fill in the blank', customIcon: '_' },
  { id: 'avatar', label: 'AI Avatar', subtitle: 'Your personal tutor', customIcon: '✦', isAvatar: true },
];

const SALMON = ACCENT_BLUE;

const SOURCE_EMOJI: Record<string, string> = { audio: '🎤', image: '📷', file: '📄', notes: '📝' };

export default function ChooseMethodsScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAvatarMode, setIsAvatarMode] = useState(false);
  const [materialTitle, setMaterialTitle] = useState<string | null>(null);

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
  const canStartAvatar = contentItems.length > 0 && !isGenerating;
  if (__DEV__ && contentItems.length > 0) console.log('[Studypup] Generate button state:', { selectedCount: selected.length, contentCount: contentItems.length, isGenerating, canGenerate });

  const handleStartAvatar = async () => {
    if (!canStartAvatar) return;

    setIsAvatarMode(true);
    setIsGenerating(true);
    try {
      const text = await contentToText(contentItems, () => {});
      if (!text.trim()) {
        Alert.alert('No content', 'Could not extract text from your content.');
        return;
      }
      const userId = (await getItem('userId')) ?? 'local_user';
      const { materials } = await processContentAndGenerateMaterials(userId, text, 'lecture', {}, true, ['notes']);
      if (materials.title) {
        setMaterialTitle(materials.title);
        await new Promise((r) => setTimeout(r, 1800));
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push({ pathname: '/avatar-tutor' as any, params: { materialId: materials.id } });
    } catch (err: any) {
      Alert.alert('Failed to start session', err.message ?? 'Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerate = async () => {
    console.log('[Studypup] handleGenerate called!'); // Always show this
    if (!canGenerate) {
      if (__DEV__) console.log('[Studypup] Generate button pressed but disabled:', { selectedCount: selected.length, contentCount: contentItems.length, isGenerating });
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
      if (materials.title) {
        setMaterialTitle(materials.title);
        await new Promise((r) => setTimeout(r, 2200));
      }
      
      const sources = contentItems.map((c) => ({
        name: c.name,
        type: c.type,
        emoji: SOURCE_EMOJI[c.type] ?? '📄',
      }));
      await updateMaterials(materials.id, { sources });
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
        <GeneratingContentScreen
          contentTypes={selected}
          contentName={contentItems[0]?.name}
          materialTitle={materialTitle}
          isAvatarTutor={isAvatarMode}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={DEEP_BLACK} />
        </Pressable>
        <Text style={styles.title}>Choose Methods</Text>
      </View>

      <View style={styles.contentRow}>
        <Image source={require('../assets/icons/contenticon.png')} style={styles.contentIcon} />
        <Text style={styles.contentLabel} numberOfLines={1}>
          {`${selected.length} item${selected.length === 1 ? '' : 's'}`}
        </Text>
        <Pressable style={styles.addBtn} onPress={() => router.back()}>
          <Text style={styles.addBtnText}>{contentItems.length > 0 ? 'Change' : '+ Add'}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {METHODS.map((m) => (
          <Pressable
            key={m.id}
            onPress={'isAvatar' in m && m.isAvatar ? handleStartAvatar : () => toggle(m.id)}
            style={[
              styles.methodBtn,
              m.id === 'written' && styles.methodBtnFlat,
              'isAvatar' in m && m.isAvatar && styles.methodBtnAvatar,
              !('isAvatar' in m && m.isAvatar) && selected.includes(m.id) && styles.methodBtnSelected,
            ]}
          >
            {'customIcon' in m && m.customIcon ? (
              <View style={styles.methodIconWrap}>
                <Text style={['isAvatar' in m && m.isAvatar ? styles.methodCustomIconGold : styles.methodCustomIcon]}>{m.customIcon}</Text>
              </View>
            ) : (
              <Image source={m.icon} style={styles.methodIcon} />
            )}
            <View>
              <Text style={'isAvatar' in m && m.isAvatar ? styles.methodLabelAvatar : styles.methodLabel}>{m.label}</Text>
              {'subtitle' in m && m.subtitle ? (
                <Text style={styles.methodSubtitle}>{m.subtitle}</Text>
              ) : null}
            </View>
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
  generatingWrap: { flex: 1, backgroundColor: OFF_WHITE },
  container: { flex: 1, backgroundColor: OFF_WHITE, paddingHorizontal: RESPONSIVE.containerPadding },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleSize(24),
    paddingVertical: scaleSize(8),
  },
  backBtn: { padding: scaleSize(4) },
  title: {
    flex: 1,
    fontFamily: 'FredokaOne_400Regular',
    fontSize: scaleFont(22),
    color: DEEP_BLACK,
    textAlign: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleSize(24),
    gap: scaleSize(14),
  },
  contentIcon: { width: RESPONSIVE.iconSmall, height: RESPONSIVE.iconSmall },
  contentLabel: {
    flex: 1,
    flexShrink: 0,
    fontFamily: 'Fredoka_400Regular',
    fontSize: RESPONSIVE.subtitle,
    color: DEEP_BLACK,
  },
  addBtn: {
    backgroundColor: '#E8E8E6',
    borderRadius: scaleSize(20),
    paddingVertical: scaleSize(10),
    paddingHorizontal: scaleSize(16),
    marginRight: scaleSize(120),
    borderWidth: 1,
    borderColor: '#D0D0CE',
  },
  addBtnText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: RESPONSIVE.body,
    color: DEEP_BLACK,
  },
  list: { flex: 1 },
  listContent: { paddingBottom: scaleSize(24) },
  methodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: scaleSize(16),
    paddingVertical: scaleSize(16),
    paddingHorizontal: scaleSize(20),
    marginBottom: scaleSize(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    gap: scaleSize(16),
    minHeight: scaleSize(60),
  },
  methodBtnFlat: {
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: '#E0E0DE',
  },
  methodBtnSelected: { borderColor: ACCENT_BLUE, borderWidth: 2 },
  methodBtnAvatar: { borderColor: ACCENT_BLUE, borderWidth: 1.5, opacity: 0.85 },
  methodIcon: { width: RESPONSIVE.iconMedium, height: RESPONSIVE.iconMedium },
  methodIconWrap: { width: RESPONSIVE.iconMedium, height: RESPONSIVE.iconMedium, justifyContent: 'center', alignItems: 'center' },
  methodCustomIcon: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: RESPONSIVE.titleSmall,
    color: DEEP_BLACK,
  },
  methodCustomIconGold: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: RESPONSIVE.titleSmall,
    color: '#F5A623',
  },
  methodLabel: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: RESPONSIVE.subtitle,
    color: DEEP_BLACK,
  },
  methodLabelAvatar: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: RESPONSIVE.subtitle,
    color: ACCENT_BLUE,
  },
  methodSubtitle: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(12),
    color: METALLIC_SILVER,
    marginTop: 2,
  },
  avatarSection: { marginBottom: scaleSize(12) },
  avatarDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleSize(12),
    gap: scaleSize(10),
  },
  avatarDividerLine: { flex: 1, height: 1, backgroundColor: '#ccc' },
  avatarDividerText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(13),
    color: '#999',
  },
  avatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: scaleSize(16),
    paddingVertical: scaleSize(16),
    paddingHorizontal: scaleSize(20),
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    gap: scaleSize(14),
    borderWidth: 1.5,
    borderColor: '#ede9fe',
  },
  avatarEmoji: { fontSize: scaleFont(24) },
  avatarCardText: { flex: 1 },
  avatarTitle: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: RESPONSIVE.subtitle,
    color: '#7c3aed',
  },
  avatarSubtitle: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(12),
    color: '#999',
    marginTop: 2,
  },
  avatarChevron: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(22),
    color: '#7c3aed',
  },
  generateBtnDisabled: { opacity: 0.4 },
  generateBtn: {
    backgroundColor: ACCENT_BLUE,
    borderRadius: scaleSize(16),
    paddingVertical: scaleSize(16),
    paddingHorizontal: scaleSize(20),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scaleSize(16),
    minHeight: RESPONSIVE.buttonMinHeight,
  },
  generateBtnText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: RESPONSIVE.subtitle,
    color: '#fff',
  },
});
