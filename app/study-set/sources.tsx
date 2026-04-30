import { getMaterials, updateMaterials } from '@/lib/study-materials-storage';
import { getKnowledgeGraph } from '@/lib/knowledge-graph-storage';
import { savePendingContent } from '@/lib/content-store';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StudyMaterialSet, KnowledgeGraph } from '@/lib/knowledge-graph';

const PURPLE = '#7c3aed';
const SALMON = '#FD8A8A';

const TYPE_LABEL: Record<string, string> = {
  lecture: 'Audio Recording',
  text: 'Text / URL',
  upload: 'Document',
  manual: 'Manual Entry',
  audio: 'Audio Recording',
  image: 'Image',
  file: 'Document',
  notes: 'Text / URL',
};

const MENU_ITEMS = [
  { id: 'photos', label: 'Photos', icon: require('../../assets/u_image-v.png') },
  { id: 'upload', label: 'File Upload', icon: require('../../assets/u_file-upload-alt.png') },
  { id: 'notes', label: 'Notes / URL', icon: require('../../assets/fi_link.png') },
];

type SourceEntry = {
  title: string;
  type: string;
  aiEmoji: string;
  contentHash?: string;
  text?: string;
};

async function loadChunksText(contentHash: string): Promise<string | null> {
  try {
    const path = `${FileSystem.documentDirectory}chunks_${contentHash}.json`;
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(path);
    const parsed = JSON.parse(raw) as { chunks: string[] };
    return parsed.chunks.join('\n\n');
  } catch {
    return null;
  }
}

export default function SourcesScreen() {
  const insets = useSafeAreaInsets();
  const { materialId } = useLocalSearchParams<{ materialId: string }>();
  const [material, setMaterial] = useState<StudyMaterialSet | null>(null);
  const [kg, setKg] = useState<KnowledgeGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [notesUrl, setNotesUrl] = useState('');
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [viewSource, setViewSource] = useState<{ title: string; text: string } | null>(null);
  const [loadingText, setLoadingText] = useState(false);

  const load = useCallback(async () => {
    if (!materialId) return;
    const m = await getMaterials(materialId);
    setMaterial(m);
    if (m?.knowledge_graph_id) {
      const graph = await getKnowledgeGraph(m.knowledge_graph_id);
      setKg(graph);
    }
    setLoading(false);
  }, [materialId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const primaryEntry: SourceEntry | null = kg
    ? {
        title: material?.title ?? 'Study Set',
        type: kg.source.type,
        aiEmoji: kg.emoji ?? '📚',
        contentHash: kg.source.content_hash,
      }
    : null;

  const additionalEntries: SourceEntry[] = (material?.sources ?? []).map((s) => ({
    title: s.name,
    type: s.type,
    aiEmoji: s.emoji,
  }));

  const allEntries = primaryEntry ? [primaryEntry, ...additionalEntries] : additionalEntries;

  const handleCardPress = async (entry: SourceEntry) => {
    if (!entry.contentHash) {
      Alert.alert('No content', 'The original source text is not available.');
      return;
    }
    setLoadingText(true);
    const text = await loadChunksText(entry.contentHash);
    setLoadingText(false);
    if (!text) {
      Alert.alert('Not available', 'The source content could not be loaded.');
      return;
    }
    setViewSource({ title: entry.title, text });
  };

  const handleMenuItem = async (itemId: string) => {
    setShowMenu(false);
    if (itemId === 'photos') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') return;
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true });
      if (result.canceled || !result.assets?.length) return;
      await addSources(result.assets.map((a) => ({ name: a.fileName ?? 'Photo', type: 'image' as const, emoji: '📷' })));
      await savePendingContent(result.assets.map((a) => ({ uri: a.uri, name: a.fileName ?? 'Photo', size: a.fileSize, type: 'image' as const })));
      router.push({ pathname: '/choose-methods' });
    } else if (itemId === 'upload') {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: true });
      if (result.canceled) return;
      await addSources(result.assets.map((a) => ({ name: a.name ?? 'File', type: 'file' as const, emoji: '📄' })));
      await savePendingContent(result.assets.map((a) => ({ uri: a.uri, name: a.name ?? 'File', size: a.size, type: 'file' as const })));
      router.push({ pathname: '/choose-methods' });
    } else if (itemId === 'notes') {
      setShowNotesInput(true);
    }
  };

  const handleNotesGenerate = async () => {
    const text = notesText.trim() || notesUrl.trim();
    if (!text) { Alert.alert('', 'Please enter a URL or paste content.'); return; }
    const name = notesUrl ? 'URL / Link' : (notesText.slice(0, 28) || 'Notes');
    await addSources([{ name, type: 'notes', emoji: '📝' }]);
    await savePendingContent([{ uri: notesUrl || '', name, type: 'notes', text: notesText }]);
    setShowNotesInput(false);
    setNotesText('');
    setNotesUrl('');
    router.push({ pathname: '/choose-methods' });
  };

  const addSources = async (newSources: Array<{ name: string; type: 'notes' | 'audio' | 'image' | 'file'; emoji: string }>) => {
    if (!material || !materialId) return;
    const merged = [...(material.sources ?? []), ...newSources];
    await updateMaterials(materialId, { sources: merged });
    setMaterial((prev) => prev ? { ...prev, sources: merged } : prev);
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
        <Text style={styles.headerTitle}>Sources</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.headerDivider} />

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]} showsVerticalScrollIndicator={false}>
        {allEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No sources yet.</Text>
            <Text style={styles.emptySubtext}>Tap "Add Sources" to attach material to this study set.</Text>
          </View>
        ) : (
          allEntries.map((entry, i) => (
            <Pressable key={i} style={styles.sourceCard} onPress={() => handleCardPress(entry)}>
              <View style={styles.cardEmojiWrap}>
                <Text style={styles.cardEmoji}>{entry.aiEmoji}</Text>
              </View>
              <View style={styles.cardLeft}>
                <Text style={styles.cardTitle} numberOfLines={1}>{entry.title}</Text>
                <Text style={styles.cardType}>{TYPE_LABEL[entry.type] ?? entry.type}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#ccc" />
            </Pressable>
          ))
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={styles.addBtn} onPress={() => setShowMenu(true)}>
          <Ionicons name="add" size={22} color={PURPLE} />
          <Text style={styles.addBtnText}>Add Sources</Text>
        </Pressable>
      </View>

      {/* Loading overlay */}
      {loadingText && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={PURPLE} />
        </View>
      )}

      {/* View source text modal */}
      <Modal visible={!!viewSource} transparent animationType="slide" onRequestClose={() => setViewSource(null)}>
        <View style={[styles.viewSheet, { paddingTop: insets.top }]}>
          <View style={styles.viewHeader}>
            <Pressable onPress={() => setViewSource(null)} style={styles.backBtn} hitSlop={12}>
              <Ionicons name="chevron-back" size={28} color="#333" />
            </Pressable>
            <Text style={styles.viewTitle} numberOfLines={1}>{viewSource?.title}</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.headerDivider} />
          <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.viewText}>{viewSource?.text}</Text>
          </ScrollView>
        </View>
      </Modal>

      {/* Add menu */}
      <Modal visible={showMenu} transparent animationType="slide" onRequestClose={() => setShowMenu(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={[styles.menuSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.menuHandle} />
            <Text style={styles.menuTitle}>Add Source Material</Text>
            {MENU_ITEMS.map((item) => (
              <Pressable key={item.id} style={styles.menuItem} onPress={() => handleMenuItem(item.id)}>
                <View style={styles.menuIconWrap}>
                  <Image source={item.icon} style={styles.menuIcon} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={18} color="#ccc" />
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Notes/URL input */}
      <Modal visible={showNotesInput} transparent animationType="fade" onRequestClose={() => setShowNotesInput(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setShowNotesInput(false)}>
          <View style={[styles.notesSheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.menuTitle}>Paste Content or URL</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="https://..."
              placeholderTextColor="#999"
              value={notesUrl}
              onChangeText={setNotesUrl}
              keyboardType="url"
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.notesInput, styles.notesTextArea]}
              placeholder="Or paste text here..."
              placeholderTextColor="#999"
              value={notesText}
              onChangeText={setNotesText}
              multiline
              textAlignVertical="top"
            />
            <Pressable style={styles.generateBtn} onPress={handleNotesGenerate}>
              <Text style={styles.generateBtnText}>Add & Generate</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
  },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: 'FredokaOne_400Regular', fontSize: 22, color: '#000' },
  headerDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.08)' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontFamily: 'FredokaOne_400Regular', fontSize: 20, color: '#333', marginBottom: 8 },
  emptySubtext: { fontFamily: 'Fredoka_400Regular', fontSize: 15, color: '#888', textAlign: 'center', lineHeight: 22 },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  cardEmojiWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#e8e8e8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardEmoji: { fontSize: 22 },
  cardLeft: { flex: 1, marginRight: 10 },
  cardTitle: { fontFamily: 'FredokaOne_400Regular', fontSize: 17, color: '#111', marginBottom: 3 },
  cardType: { fontFamily: 'Fredoka_400Regular', fontSize: 13, color: '#999' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: PURPLE,
  },
  addBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: 17, color: PURPLE },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewSheet: { flex: 1, backgroundColor: '#fff' },
  viewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  viewTitle: { fontFamily: 'FredokaOne_400Regular', fontSize: 20, color: '#000', flex: 1, textAlign: 'center' },
  viewText: { fontFamily: 'Fredoka_400Regular', fontSize: 15, color: '#333', lineHeight: 24 },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  menuSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  menuHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  menuTitle: { fontFamily: 'FredokaOne_400Regular', fontSize: 18, color: '#000', marginBottom: 16, textAlign: 'center' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 14,
  },
  menuIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: SALMON, justifyContent: 'center', alignItems: 'center' },
  menuIcon: { width: 20, height: 20 },
  menuLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#333', flex: 1 },
  notesSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  notesInput: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    color: '#333',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  notesTextArea: { height: 120, textAlignVertical: 'top' },
  generateBtn: { backgroundColor: SALMON, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  generateBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: 17, color: '#fff' },
});
