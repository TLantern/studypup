import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticSelect } from '@/lib/haptics';
import { scaleFont, scaleSize } from '@/lib/responsive';
import type { ProNoteBullet, StoredProNote } from '@/lib/pro-note-store';

const SF_PRO = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });
const DEEP_BLACK = '#0D0D0F';
const SUBTITLE_GRAY = '#6B7280';

type Section = 'overview' | 'keyTopics';

interface Props {
  visible: boolean;
  note: StoredProNote;
  onClose: () => void;
  onSave: (patch: {
    title: string;
    subtitle: string;
    overview: ProNoteBullet[];
    keyTopics: ProNoteBullet[];
    actionItems: string[];
    finalReflection: string;
  }) => void;
}

export function ProNoteEditModal({ visible, note, onClose, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(note.title);
  const [subtitle, setSubtitle] = useState(note.subtitle);
  const [overview, setOverview] = useState<ProNoteBullet[]>(note.overview);
  const [keyTopics, setKeyTopics] = useState<ProNoteBullet[]>(note.keyTopics);
  const [actionItems, setActionItems] = useState<string[]>(note.actionItems);
  const [finalReflection, setFinalReflection] = useState(note.finalReflection);

  useEffect(() => {
    if (visible) {
      setTitle(note.title);
      setSubtitle(note.subtitle);
      setOverview(note.overview);
      setKeyTopics(note.keyTopics);
      setActionItems(note.actionItems);
      setFinalReflection(note.finalReflection);
    }
  }, [visible, note]);

  const updateBullet = (section: Section, idx: number, field: 'bold' | 'text', value: string) => {
    const setter = section === 'overview' ? setOverview : setKeyTopics;
    const list = section === 'overview' ? overview : keyTopics;
    const next = list.map((b, i) => (i === idx ? { ...b, [field]: value } : b));
    setter(next);
  };

  const addBullet = (section: Section) => {
    hapticSelect();
    const setter = section === 'overview' ? setOverview : setKeyTopics;
    const list = section === 'overview' ? overview : keyTopics;
    setter([...list, { bold: '', text: '' }]);
  };

  const removeBullet = (section: Section, idx: number) => {
    hapticSelect();
    const setter = section === 'overview' ? setOverview : setKeyTopics;
    const list = section === 'overview' ? overview : keyTopics;
    setter(list.filter((_, i) => i !== idx));
  };

  const updateAction = (idx: number, value: string) => {
    setActionItems(actionItems.map((a, i) => (i === idx ? value : a)));
  };

  const addAction = () => {
    hapticSelect();
    setActionItems([...actionItems, '']);
  };

  const removeAction = (idx: number) => {
    hapticSelect();
    setActionItems(actionItems.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    hapticSelect();
    onSave({
      title: title.trim() || 'Untitled',
      subtitle: subtitle.trim(),
      overview: overview.filter((b) => (b.bold || '').trim() || (b.text || '').trim()),
      keyTopics: keyTopics.filter((b) => (b.bold || '').trim() || (b.text || '').trim()),
      actionItems: actionItems.map((a) => a.trim()).filter(Boolean),
      finalReflection: finalReflection.trim(),
    });
  };

  const renderBulletEditor = (section: Section, list: ProNoteBullet[]) => (
    <>
      {list.map((b, i) => (
        <View key={i} style={styles.bulletRow}>
          <View style={{ flex: 1, gap: scaleSize(6) }}>
            <TextInput
              value={b.bold ?? ''}
              onChangeText={(v) => updateBullet(section, i, 'bold', v)}
              placeholder="Bold label (optional)"
              placeholderTextColor={SUBTITLE_GRAY}
              style={[styles.input, { fontWeight: '700' }]}
            />
            <TextInput
              value={b.text}
              onChangeText={(v) => updateBullet(section, i, 'text', v)}
              placeholder="Description"
              placeholderTextColor={SUBTITLE_GRAY}
              style={styles.input}
              multiline
            />
          </View>
          <Pressable hitSlop={8} onPress={() => removeBullet(section, i)} style={styles.removeBtn}>
            <Ionicons name="trash-outline" size={18} color="#DC2626" />
          </Pressable>
        </View>
      ))}
      <Pressable style={styles.addRow} onPress={() => addBullet(section)}>
        <Ionicons name="add-circle-outline" size={20} color={DEEP_BLACK} />
        <Text style={styles.addRowText}>Add bullet</Text>
      </Pressable>
    </>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.root, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Edit Note</Text>
            <Pressable onPress={handleSave} hitSlop={12}>
              <Text style={styles.saveText}>Save</Text>
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: scaleSize(20), paddingBottom: insets.bottom + scaleSize(40) }}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.label}>Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              style={[styles.input, { fontSize: scaleFont(18), fontWeight: '700' }]}
              placeholder="Note title"
              placeholderTextColor={SUBTITLE_GRAY}
            />

            <Text style={styles.label}>Subtitle</Text>
            <TextInput
              value={subtitle}
              onChangeText={setSubtitle}
              style={styles.input}
              placeholder="Subtitle"
              placeholderTextColor={SUBTITLE_GRAY}
              multiline
            />

            <Text style={styles.sectionHeader}>Overview</Text>
            {renderBulletEditor('overview', overview)}

            <Text style={styles.sectionHeader}>Key Topics</Text>
            {renderBulletEditor('keyTopics', keyTopics)}

            <Text style={styles.sectionHeader}>Action Items</Text>
            {actionItems.map((a, i) => (
              <View key={i} style={styles.bulletRow}>
                <TextInput
                  value={a}
                  onChangeText={(v) => updateAction(i, v)}
                  placeholder="Action item"
                  placeholderTextColor={SUBTITLE_GRAY}
                  style={[styles.input, { flex: 1 }]}
                  multiline
                />
                <Pressable hitSlop={8} onPress={() => removeAction(i)} style={styles.removeBtn}>
                  <Ionicons name="trash-outline" size={18} color="#DC2626" />
                </Pressable>
              </View>
            ))}
            <Pressable style={styles.addRow} onPress={addAction}>
              <Ionicons name="add-circle-outline" size={20} color={DEEP_BLACK} />
              <Text style={styles.addRowText}>Add action item</Text>
            </Pressable>

            <Text style={styles.sectionHeader}>Final Reflection</Text>
            <TextInput
              value={finalReflection}
              onChangeText={setFinalReflection}
              style={[styles.input, { minHeight: scaleSize(80) }]}
              placeholder="Final reflection"
              placeholderTextColor={SUBTITLE_GRAY}
              multiline
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F4' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scaleSize(20),
    paddingVertical: scaleSize(12),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  headerTitle: { fontFamily: SF_PRO, fontSize: scaleFont(17), fontWeight: '700', color: DEEP_BLACK },
  cancelText: { fontFamily: SF_PRO, fontSize: scaleFont(16), color: DEEP_BLACK },
  saveText: { fontFamily: SF_PRO, fontSize: scaleFont(16), fontWeight: '700', color: '#3B82F6' },
  label: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(13),
    fontWeight: '600',
    color: SUBTITLE_GRAY,
    marginTop: scaleSize(12),
    marginBottom: scaleSize(6),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHeader: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(16),
    fontWeight: '700',
    color: DEEP_BLACK,
    marginTop: scaleSize(20),
    marginBottom: scaleSize(10),
  },
  input: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    color: DEEP_BLACK,
    backgroundColor: '#FFF',
    borderRadius: scaleSize(10),
    paddingHorizontal: scaleSize(12),
    paddingVertical: scaleSize(10),
  },
  bulletRow: {
    flexDirection: 'row',
    gap: scaleSize(8),
    alignItems: 'flex-start',
    marginBottom: scaleSize(8),
  },
  removeBtn: {
    width: scaleSize(36),
    height: scaleSize(36),
    borderRadius: scaleSize(18),
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(6),
    paddingVertical: scaleSize(8),
  },
  addRowText: { fontFamily: SF_PRO, fontSize: scaleFont(14), color: DEEP_BLACK, fontWeight: '500' },
});
