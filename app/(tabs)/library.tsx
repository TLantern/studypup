import { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { StudyMaterialSet } from '@/lib/knowledge-graph';
import { listAllMaterials } from '@/lib/study-materials-storage';
import { noteFromStudyMaterialSet, getMasteryColor } from '@/lib/notes';
import {
  StudentFolder,
  getAllFolders,
  createFolder,
  deleteFolder,
  getMaterialFolderMap,
  setMaterialFolder,
} from '@/lib/student-folders';
import { SF_PRO, DEEP_BLACK, ACCENT_BLUE, OFF_WHITE, SUBTITLE_GRAY, HAIRLINE } from '@/lib/onboarding-theme';

const UNFILED = '__unfiled__';

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const [folders, setFolders] = useState<StudentFolder[]>([]);
  const [materials, setMaterials] = useState<StudyMaterialSet[]>([]);
  const [folderMap, setFolderMap] = useState<Record<string, string>>({});
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showAddNotes, setShowAddNotes] = useState(false);

  const load = useCallback(async () => {
    const [f, m, map] = await Promise.all([getAllFolders(), listAllMaterials(), getMaterialFolderMap()]);
    setFolders(f);
    setMaterials(m);
    setFolderMap(map);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const unfiledMaterials = useMemo(
    () => materials.filter((m) => !folderMap[m.id]),
    [materials, folderMap]
  );

  const materialsInSelectedFolder = useMemo(() => {
    if (!selectedFolderId) return [];
    if (selectedFolderId === UNFILED) return unfiledMaterials;
    return materials.filter((m) => folderMap[m.id] === selectedFolderId);
  }, [selectedFolderId, materials, folderMap, unfiledMaterials]);

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    await createFolder(name);
    setNewFolderName('');
    setShowNewFolder(false);
    load();
  };

  const handleDeleteFolder = async (id: string) => {
    await deleteFolder(id);
    if (selectedFolderId === id) setSelectedFolderId(null);
    load();
  };

  const handleAddToFolder = async (materialId: string) => {
    if (!selectedFolderId || selectedFolderId === UNFILED) return;
    await setMaterialFolder(materialId, selectedFolderId);
    setShowAddNotes(false);
    load();
  };

  const contentPadding = 20;

  if (selectedFolderId) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <View style={[styles.detailHeader, { paddingHorizontal: contentPadding }]}>
          <Pressable onPress={() => setSelectedFolderId(null)} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color={DEEP_BLACK} />
          </Pressable>
          <Text style={styles.detailTitle} numberOfLines={1}>
            {selectedFolderId === UNFILED ? 'Unfiled Notes' : selectedFolder?.name}
          </Text>
          {selectedFolderId !== UNFILED ? (
            <Pressable onPress={() => handleDeleteFolder(selectedFolderId)} hitSlop={12}>
              <Ionicons name="trash-outline" size={22} color={SUBTITLE_GRAY} />
            </Pressable>
          ) : (
            <View style={{ width: 22 }} />
          )}
        </View>

        {selectedFolderId !== UNFILED && (
          <Pressable style={[styles.addNotesBtn, { marginHorizontal: contentPadding }]} onPress={() => setShowAddNotes(true)}>
            <Ionicons name="add" size={18} color={ACCENT_BLUE} />
            <Text style={styles.addNotesBtnText}>Add Notes</Text>
          </Pressable>
        )}

        <FlatList
          data={materialsInSelectedFolder}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: contentPadding, paddingBottom: 140 }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {selectedFolderId === UNFILED ? "You're all filed away." : 'No notes in this folder yet.'}
            </Text>
          }
          renderItem={({ item }) => {
            const note = noteFromStudyMaterialSet(item);
            return (
              <Pressable style={styles.noteCard} onPress={() => router.push(`/study-set/${note.id}`)}>
                <View style={styles.noteEmojiContainer}>
                  <Text style={styles.noteEmoji}>{note.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.noteName} numberOfLines={1}>{note.name}</Text>
                  <Text style={styles.noteMeta}>{note.date} · Mastery {note.mastery}%</Text>
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBar, { width: `${note.mastery}%`, backgroundColor: getMasteryColor(note.mastery) }]} />
                  </View>
                </View>
              </Pressable>
            );
          }}
        />

        <Modal visible={showAddNotes} transparent animationType="slide" onRequestClose={() => setShowAddNotes(false)}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setShowAddNotes(false)}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.sheetTitle}>Add Notes to {selectedFolder?.name}</Text>
              <FlatList
                data={unfiledMaterials}
                keyExtractor={(m) => m.id}
                style={{ maxHeight: 360 }}
                ListEmptyComponent={<Text style={styles.emptyText}>No unfiled notes to add.</Text>}
                renderItem={({ item }) => {
                  const note = noteFromStudyMaterialSet(item);
                  return (
                    <Pressable style={styles.pickRow} onPress={() => handleAddToFolder(item.id)}>
                      <Text style={styles.pickEmoji}>{note.emoji}</Text>
                      <Text style={styles.pickName} numberOfLines={1}>{note.name}</Text>
                      <Ionicons name="add-circle-outline" size={22} color={ACCENT_BLUE} />
                    </Pressable>
                  );
                }}
              />
              <Pressable style={styles.sheetCloseBtn} onPress={() => setShowAddNotes(false)}>
                <Text style={styles.sheetCloseBtnText}>Done</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={[styles.header, { paddingHorizontal: contentPadding }]}>
        <Text style={styles.headerTitle}>Library</Text>
        <Pressable style={styles.newFolderBtn} onPress={() => setShowNewFolder(true)} hitSlop={8}>
          <Ionicons name="add" size={20} color="#fff" />
        </Pressable>
      </View>

      <FlatList
        data={folders}
        keyExtractor={(f) => f.id}
        contentContainerStyle={{ padding: contentPadding, paddingBottom: 140 }}
        ListHeaderComponent={
          <Pressable style={styles.folderCard} onPress={() => setSelectedFolderId(UNFILED)}>
            <View style={[styles.folderIconWrap, { backgroundColor: '#EEF3FF' }]}>
              <Ionicons name="document-text-outline" size={26} color={ACCENT_BLUE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.folderName}>Unfiled Notes</Text>
              <Text style={styles.folderCount}>{unfiledMaterials.length} {unfiledMaterials.length === 1 ? 'note' : 'notes'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={SUBTITLE_GRAY} />
          </Pressable>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No folders yet. Tap + to create one.</Text>
        }
        renderItem={({ item }) => {
          const count = materials.filter((m) => folderMap[m.id] === item.id).length;
          return (
            <Pressable style={styles.folderCard} onPress={() => setSelectedFolderId(item.id)}>
              <View style={styles.folderIconWrap}>
                <Ionicons name="folder" size={26} color={DEEP_BLACK} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.folderName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.folderCount}>{count} {count === 1 ? 'note' : 'notes'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={SUBTITLE_GRAY} />
            </Pressable>
          );
        }}
      />

      <Modal visible={showNewFolder} transparent animationType="fade" onRequestClose={() => setShowNewFolder(false)}>
        <Pressable style={styles.newFolderBackdrop} onPress={() => setShowNewFolder(false)}>
          <Pressable style={styles.newFolderModal} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>New Folder</Text>
            <TextInput
              style={styles.folderInput}
              placeholder="Folder name"
              placeholderTextColor="#999"
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus
              onSubmitEditing={handleCreateFolder}
            />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <Pressable style={[styles.modalBtn, styles.modalBtnGhost]} onPress={() => { setShowNewFolder(false); setNewFolderName(''); }}>
                <Text style={styles.modalBtnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={handleCreateFolder}>
                <Text style={styles.modalBtnPrimaryText}>Create</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: OFF_WHITE },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerTitle: { fontFamily: 'FredokaOne_400Regular', fontSize: 28, color: DEEP_BLACK },
  newFolderBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: DEEP_BLACK,
    alignItems: 'center', justifyContent: 'center',
  },
  folderCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18,
    padding: 14, marginBottom: 12, borderWidth: 1, borderColor: HAIRLINE,
  },
  folderIconWrap: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  folderName: { fontFamily: 'FredokaOne_400Regular', fontSize: 17, color: DEEP_BLACK, marginBottom: 2 },
  folderCount: { fontFamily: SF_PRO, fontSize: 13, color: SUBTITLE_GRAY },
  emptyText: { fontFamily: SF_PRO, fontSize: 15, color: SUBTITLE_GRAY, textAlign: 'center', marginTop: 40 },

  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  backBtn: { marginRight: 8 },
  detailTitle: { fontFamily: 'FredokaOne_400Regular', fontSize: 20, color: DEEP_BLACK, flex: 1, textAlign: 'center' },
  addNotesBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4,
    backgroundColor: '#EEF3FF', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, marginTop: 4,
  },
  addNotesBtnText: { fontFamily: SF_PRO, fontSize: 14, fontWeight: '600', color: ACCENT_BLUE },

  noteCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18,
    padding: 14, marginBottom: 12, borderWidth: 1, borderColor: HAIRLINE,
  },
  noteEmojiContainer: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  noteEmoji: { fontSize: 28 },
  noteName: { fontFamily: 'FredokaOne_400Regular', fontSize: 16, color: DEEP_BLACK, marginBottom: 4 },
  noteMeta: { fontFamily: SF_PRO, fontSize: 13, color: SUBTITLE_GRAY, marginBottom: 8 },
  progressBarContainer: { height: 8, borderRadius: 4, backgroundColor: '#EEE', overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 4 },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  newFolderBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '70%' },
  sheetTitle: { fontFamily: 'FredokaOne_400Regular', fontSize: 18, color: DEEP_BLACK, marginBottom: 14 },
  sheetCloseBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  sheetCloseBtnText: { fontFamily: SF_PRO, fontSize: 16, fontWeight: '600', color: ACCENT_BLUE },
  pickRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10,
    borderBottomWidth: 1, borderBottomColor: HAIRLINE,
  },
  pickEmoji: { fontSize: 22 },
  pickName: { flex: 1, fontFamily: SF_PRO, fontSize: 15, color: DEEP_BLACK },

  newFolderModal: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20, marginHorizontal: 32, alignSelf: 'center', width: '84%',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
  },
  folderInput: {
    height: 46, borderRadius: 12, backgroundColor: '#F5F5F5', paddingHorizontal: 14,
    fontFamily: SF_PRO, fontSize: 16, color: DEEP_BLACK,
  },
  modalBtn: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalBtnGhost: { backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  modalBtnGhostText: { fontFamily: SF_PRO, fontSize: 15, fontWeight: '600', color: SUBTITLE_GRAY },
  modalBtnPrimary: { backgroundColor: ACCENT_BLUE, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  modalBtnPrimaryText: { fontFamily: SF_PRO, fontSize: 15, fontWeight: '600', color: '#fff' },
});
