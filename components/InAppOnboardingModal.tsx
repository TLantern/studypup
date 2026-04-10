import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { savePendingContent, type ContentItem } from '@/lib/content-store';
import { fetchYouTubeTranscript, extractVideoId } from '@/lib/youtube-transcript';

const MINT = '#B5EAE4';
const TILE_BG = '#FFFFFF';
const SALMON = '#FD8A8A';

type OptionId = 'audio' | 'youtube' | 'file' | 'photo' | 'text';

const OPTIONS = [
  { id: 'audio'   as OptionId, label: 'Audio',   sub: 'Lecture recording, voice memo',    icon: 'mic',           iconColor: '#7C5CBF', iconBg: '#EDE7F6' },
  { id: 'youtube' as OptionId, label: 'YouTube', sub: 'Paste a lecture or video link',     icon: 'logo-youtube',  iconColor: '#E53935', iconBg: '#FFEBEE' },
  { id: 'file'    as OptionId, label: 'File',    sub: 'PDF, PPTX, DOCX, notes',            icon: 'document',      iconColor: '#0D9488', iconBg: '#E0F2F1' },
  { id: 'photo'   as OptionId, label: 'Photo',   sub: 'Whiteboard, handwritten notes',     icon: 'camera',        iconColor: '#F57C00', iconBg: '#FFF3E0' },
  { id: 'text'    as OptionId, label: 'Text',    sub: 'Paste or type your notes directly',  icon: 'document-text', iconColor: '#1976D2', iconBg: '#E3F2FD' },
];

const STEP2: Record<OptionId, { header: string; sub: string; icon: string; iconColor: string; iconBg: string }> = {
  audio:   { header: 'Upload your lecture recording',  sub: "We'll transcribe and turn it into a study set for you.", icon: 'mic',           iconColor: '#7C5CBF', iconBg: '#EDE7F6' },
  youtube: { header: 'Paste your video link',          sub: 'Got a recorded lecture or tutorial? Drop the link below.', icon: 'logo-youtube',  iconColor: '#E53935', iconBg: '#FFEBEE' },
  file:    { header: 'Upload your notes or slides',    sub: "We'll pull out the key concepts automatically.",          icon: 'document',      iconColor: '#0D9488', iconBg: '#E0F2F1' },
  photo:   { header: 'Snap or upload your notes',      sub: 'Whiteboard, textbook, handwritten — we can read it all.', icon: 'camera',        iconColor: '#F57C00', iconBg: '#FFF3E0' },
  text:    { header: 'Paste your notes in',            sub: "Copy from anywhere and we'll do the rest.",               icon: 'document-text', iconColor: '#1976D2', iconBg: '#E3F2FD' },
};

export function InAppOnboardingModal({ visible, onContinue }: { visible: boolean; onContinue: () => void }) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const s = getStyles(isTablet);
  const [step, setStep] = useState<'pick' | 'input'>('pick');
  const [selectedId, setSelectedId] = useState<OptionId | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [pickedFiles, setPickedFiles] = useState<{ uri: string; name: string; size?: number }[]>([]);

  const handleSelect = (id: OptionId) => {
    Haptics.selectionAsync();
    setSelectedId(id);
    setPickedFiles([]);
    setUrlInput('');
    setTextInput('');
    setStep('input');
  };

  const handleBack = () => setStep('pick');

  const pickAudio = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['audio/*'], copyToCacheDirectory: true });
    if (!result.canceled && result.assets?.[0]) {
      const a = result.assets[0];
      setPickedFiles((prev) => [...prev, { uri: a.uri, name: a.name, size: a.size }]);
    }
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
             'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/*'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const a = result.assets[0];
      setPickedFiles((prev) => [...prev, { uri: a.uri, name: a.name, size: a.size }]);
    }
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] as any });
    if (!result.canceled && result.assets?.[0]) {
      const a = result.assets[0];
      setPickedFiles((prev) => [...prev, { uri: a.uri, name: a.fileName ?? 'photo.jpg', size: a.fileSize }]);
    }
  };

  const removeFile = (index: number) => setPickedFiles((prev) => prev.filter((_, i) => i !== index));

  const handleContinue = async () => {
    let items: ContentItem[] = [];

    if (selectedId === 'youtube' && urlInput.trim()) {
      const url = urlInput.trim();
      const videoId = extractVideoId(url);
      let transcriptText = '';
      if (videoId) {
        const result = await fetchYouTubeTranscript(videoId);
        transcriptText = result.text || '';
      }
      items = [{ uri: url, name: 'YouTube Video', type: 'notes', text: transcriptText }];
    } else if (selectedId === 'text' && textInput.trim()) {
      const t = textInput.trim();
      const name = (t.replace(/\s+/g, ' ').slice(0, 28) || 'Content').trim();
      items = [{ uri: '', name, type: 'notes', text: t }];
    } else if (selectedId === 'audio' && pickedFiles.length > 0) {
      items = pickedFiles.map((f) => ({ uri: f.uri, name: f.name, size: f.size, type: 'audio' as const }));
    } else if (selectedId === 'file' && pickedFiles.length > 0) {
      items = pickedFiles.map((f) => ({ uri: f.uri, name: f.name, size: f.size, type: 'file' as const }));
    } else if (selectedId === 'photo' && pickedFiles.length > 0) {
      items = pickedFiles.map((f) => ({ uri: f.uri, name: f.name, size: f.size, type: 'image' as const }));
    }

    if (items.length > 0) await savePendingContent(items);
    onContinue();
    router.push('/choose-methods');
  };

  const s2info = selectedId ? STEP2[selectedId] : null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={s.backdrop}>
        <ScrollView
          style={{ width: '100%', flex: 1 }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.card}>

            {/* ── STEP 1: pick ── */}
            {step === 'pick' && (
              <View>
                <Text style={s.title}>What are we studying today?</Text>
                <Text style={s.subtitle}>
                  Add your lecture, notes, or slides and we'll handle the rest.
                </Text>

                <View style={s.grid}>
                  {OPTIONS.slice(0, 4).map((opt) => (
                    <Pressable key={opt.id} style={s.tile} onPress={() => handleSelect(opt.id)}>
                      <View style={[s.iconWrap, { backgroundColor: opt.iconBg }]}>
                        <Ionicons name={opt.icon as any} size={isTablet ? 28 : 18} color={opt.iconColor} />
                      </View>
                      <Text style={s.tileLabel}>{opt.label}</Text>
                      <Text style={s.tileSub} numberOfLines={2}>{opt.sub}</Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable style={[s.tile, s.tileWide]} onPress={() => handleSelect('text')}>
                  <View style={[s.iconWrap, { marginBottom: 0, backgroundColor: OPTIONS[4].iconBg }]}>
                    <Ionicons name={OPTIONS[4].icon as any} size={isTablet ? 28 : 18} color={OPTIONS[4].iconColor} />
                  </View>
                  <View>
                    <Text style={s.tileLabel}>{OPTIONS[4].label}</Text>
                    <Text style={s.tileSub}>{OPTIONS[4].sub}</Text>
                  </View>
                </Pressable>

                <View style={s.dropZone}>
                  <View style={s.dropIconWrap}>
                    <Ionicons name="mic" size={isTablet ? 36 : 22} color="#7C5CBF" />
                  </View>
                  <Text style={s.dropTitle}>Drop your audio file here</Text>
                  <Text style={s.dropBrowse}>or browse files</Text>
                  <Text style={s.dropHint}>MP3, WAV, M4A — up to 2 hours</Text>
                </View>
              </View>
            )}

            {/* ── STEP 2: input ── */}
            {step === 'input' && s2info && (
              <View>
                <View style={s.step2Header}>
                  <Pressable onPress={handleBack} hitSlop={12} style={s.backBtn}>
                    <Ionicons name="chevron-back" size={isTablet ? 32 : 22} color="#1A1A2E" />
                  </Pressable>
                </View>

                {(selectedId === 'youtube' || selectedId === 'text') && (
                  <View style={[s.iconWrap, { backgroundColor: s2info.iconBg, marginBottom: 0, alignSelf: 'center', marginTop: 12, width: isTablet ? 72 : 44, height: isTablet ? 72 : 44, borderRadius: isTablet ? 20 : 13 }]}>
                    <Ionicons name={s2info.icon as any} size={isTablet ? 36 : 22} color={s2info.iconColor} />
                  </View>
                )}
                <Text style={[s.title, { marginTop: 10 }]}>{s2info.header}</Text>
                <Text style={[s.subtitle, { marginBottom: 16 }]}>{s2info.sub}</Text>

                {selectedId === 'youtube' && (
                  <TextInput
                    style={s.urlInput}
                    placeholder="https://youtube.com/watch?v=..."
                    placeholderTextColor="#999"
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={urlInput}
                    onChangeText={setUrlInput}
                  />
                )}

                {selectedId === 'text' && (
                  <TextInput
                    style={s.textArea}
                    placeholder="Paste or type your notes here..."
                    placeholderTextColor="#999"
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                    value={textInput}
                    onChangeText={setTextInput}
                  />
                )}

                {(selectedId === 'audio' || selectedId === 'file') && (
                  <View>
                    {pickedFiles.length === 0 ? (
                      <Pressable style={s.dropZone} onPress={selectedId === 'audio' ? pickAudio : pickFile}>
                        <View style={[s.dropIconWrap, { backgroundColor: s2info.iconBg }]}>
                          <Ionicons name={s2info.icon as any} size={isTablet ? 36 : 22} color={s2info.iconColor} />
                        </View>
                        <Text style={s.dropTitle}>
                          {selectedId === 'audio' ? 'Drop your audio file here' : 'Drop your file here'}
                        </Text>
                        <Text style={s.dropBrowse}>or browse files</Text>
                        <Text style={s.dropHint}>
                          {selectedId === 'audio' ? 'MP3, WAV, M4A — up to 2 hours' : 'PDF, PPTX, DOCX'}
                        </Text>
                      </Pressable>
                    ) : (
                      <View style={s.fileList}>
                        {pickedFiles.map((f, i) => (
                          <View key={`${f.uri}-${i}`} style={s.fileRow}>
                            <View style={[s.iconWrap, { backgroundColor: s2info.iconBg, marginBottom: 0, flexShrink: 0 }]}>
                              <Ionicons name={s2info.icon as any} size={isTablet ? 24 : 16} color={s2info.iconColor} />
                            </View>
                            <Text style={s.fileName} numberOfLines={1} ellipsizeMode="middle">{f.name}</Text>
                            <Pressable onPress={() => removeFile(i)} hitSlop={8}>
                              <Ionicons name="close-circle" size={isTablet ? 28 : 18} color="#999" />
                            </Pressable>
                          </View>
                        ))}
                        <Pressable style={s.addAnotherBtn} onPress={selectedId === 'audio' ? pickAudio : pickFile}>
                          <Ionicons name="add-circle-outline" size={isTablet ? 24 : 16} color="#0D9488" />
                          <Text style={s.addAnotherText}>Add another</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                )}

                {selectedId === 'photo' && (
                  <View>
                    {pickedFiles.length === 0 ? (
                      <Pressable style={s.photoPickerZone} onPress={pickPhoto}>
                        <View style={[s.dropIconWrap, { backgroundColor: s2info.iconBg }]}>
                          <Ionicons name="camera" size={isTablet ? 36 : 22} color={s2info.iconColor} />
                        </View>
                        <Text style={s.dropTitle}>Take a photo or upload</Text>
                        <Text style={s.dropBrowse}>from your camera roll</Text>
                      </Pressable>
                    ) : (
                      <View style={s.fileList}>
                        {pickedFiles.map((f, i) => (
                          <View key={`${f.uri}-${i}`} style={s.fileRow}>
                            <View style={[s.iconWrap, { backgroundColor: s2info.iconBg, marginBottom: 0, flexShrink: 0 }]}>
                              <Ionicons name="camera" size={isTablet ? 24 : 16} color={s2info.iconColor} />
                            </View>
                            <Text style={s.fileName} numberOfLines={1} ellipsizeMode="middle">{f.name}</Text>
                            <Pressable onPress={() => removeFile(i)} hitSlop={8}>
                              <Ionicons name="close-circle" size={isTablet ? 28 : 18} color="#999" />
                            </Pressable>
                          </View>
                        ))}
                        <Pressable style={s.addAnotherBtn} onPress={pickPhoto}>
                          <Ionicons name="add-circle-outline" size={isTablet ? 24 : 16} color="#0D9488" />
                          <Text style={s.addAnotherText}>Add another</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                )}

                <Pressable style={[s.continueBtn, { marginTop: 16 }]} onPress={handleContinue}>
                  <Text style={s.continueBtnText}>Continue</Text>
                </Pressable>
              </View>
            )}

          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function getStyles(t: boolean) {
  const sc = (n: number) => t ? n * 1.9 : n;
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
    scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: t ? 48 : 20, paddingTop: t ? 80 : 48, paddingBottom: t ? 40 : 20 },
    card: { backgroundColor: MINT, borderRadius: sc(24), padding: sc(16), width: '100%', maxWidth: t ? 760 : 420, alignSelf: 'center', marginTop: t ? -40 : 0 },
    title: { fontFamily: 'FredokaOne_400Regular', fontSize: sc(28), color: '#1A1A2E', marginTop: sc(12), marginBottom: sc(4), textAlign: 'center' },
    subtitle: { fontFamily: 'Fredoka_400Regular', fontSize: sc(13), color: '#444', textAlign: 'center', marginBottom: sc(12), lineHeight: sc(18) },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: sc(8), marginBottom: sc(8) },
    tile: { backgroundColor: TILE_BG, borderRadius: sc(14), padding: sc(10), width: '48%' },
    tileWide: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: sc(10), marginBottom: sc(10) },
    iconWrap: { width: sc(32), height: sc(32), borderRadius: sc(9), justifyContent: 'center', alignItems: 'center', marginBottom: sc(6) },
    tileLabel: { fontFamily: 'Fredoka_400Regular', fontSize: sc(14), color: '#1A1A2E', marginBottom: 1 },
    tileSub: { fontFamily: 'Fredoka_400Regular', fontSize: sc(11), color: '#666', lineHeight: sc(14) },
    dropZone: { borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.18)', borderStyle: 'dashed', borderRadius: sc(14), paddingVertical: sc(16), alignItems: 'center', marginBottom: sc(12), backgroundColor: TILE_BG },
    photoPickerZone: { borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.18)', borderStyle: 'dashed', borderRadius: sc(14), paddingVertical: sc(20), alignItems: 'center', marginBottom: sc(12), backgroundColor: TILE_BG },
    dropIconWrap: { width: sc(44), height: sc(44), borderRadius: sc(13), backgroundColor: '#EDE7F6', justifyContent: 'center', alignItems: 'center', marginBottom: sc(8) },
    dropTitle: { fontFamily: 'Fredoka_400Regular', fontSize: sc(14), color: '#1A1A2E', marginBottom: 3 },
    dropBrowse: { fontFamily: 'Fredoka_400Regular', fontSize: sc(13), color: '#0D9488', marginBottom: 3 },
    dropHint: { fontFamily: 'Fredoka_400Regular', fontSize: sc(11), color: '#666' },
    step2Header: { flexDirection: 'row', alignItems: 'center' },
    backBtn: { width: sc(32), height: sc(32), borderRadius: sc(9), backgroundColor: 'rgba(0,0,0,0.08)', justifyContent: 'center', alignItems: 'center' },
    urlInput: { backgroundColor: TILE_BG, borderRadius: sc(14), paddingHorizontal: sc(14), paddingVertical: sc(13), fontFamily: 'Fredoka_400Regular', fontSize: sc(14), color: '#1A1A2E', marginBottom: sc(12) },
    textArea: { backgroundColor: TILE_BG, borderRadius: sc(14), paddingHorizontal: sc(14), paddingVertical: sc(13), fontFamily: 'Fredoka_400Regular', fontSize: sc(14), color: '#1A1A2E', marginBottom: sc(12), minHeight: sc(130) },
    fileList: { backgroundColor: TILE_BG, borderRadius: sc(14), paddingHorizontal: sc(12), paddingTop: sc(8), paddingBottom: sc(4), marginBottom: sc(12) },
    fileRow: { flexDirection: 'row', alignItems: 'center', gap: sc(10), paddingVertical: sc(8), borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
    fileName: { flex: 1, fontFamily: 'Fredoka_400Regular', fontSize: sc(13), color: '#1A1A2E' },
    addAnotherBtn: { flexDirection: 'row', alignItems: 'center', gap: sc(6), paddingVertical: sc(10) },
    addAnotherText: { fontFamily: 'Fredoka_400Regular', fontSize: sc(13), color: '#0D9488' },
    continueBtn: { backgroundColor: SALMON, borderRadius: sc(32), paddingVertical: sc(13), alignItems: 'center' },
    continueBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: sc(17), color: '#fff' },
  });
}
