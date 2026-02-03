import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export function LocationPickerModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (country: string, state: string) => void;
}) {
  const [country, setCountry] = useState('United States');
  const [state, setState] = useState('Texas');
  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>Change Country & State</Text>
          <View style={styles.pickerRow}>
            <Text style={styles.pickerLabel}>Country</Text>
            <Pressable style={styles.pickerBtn} onPress={() => {}}>
              <Text style={styles.pickerValue}>{country}</Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </Pressable>
          </View>
          <View style={styles.pickerRow}>
            <Text style={styles.pickerLabel}>State</Text>
            <Pressable style={styles.pickerBtn} onPress={() => {}}>
              <Text style={styles.pickerValue}>{state}</Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </Pressable>
          </View>
          <View style={styles.modalActions}>
            <Pressable style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={styles.modalDoneBtn}
              onPress={() => {
                onSelect(country, state);
                onClose();
              }}
            >
              <Text style={styles.modalDoneText}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontFamily: 'FredokaOne_400Regular', fontSize: 20, marginBottom: 20, textAlign: 'center' },
  pickerRow: { marginBottom: 16 },
  pickerLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 14, color: '#666', marginBottom: 8 },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16 },
  pickerValue: { fontFamily: 'Fredoka_400Regular', fontSize: 16 },
  pickerArrow: { fontSize: 12, color: '#666' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalCancelBtn: { flex: 1, padding: 16, alignItems: 'center', borderRadius: 12, backgroundColor: '#eee' },
  modalCancelText: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#333' },
  modalDoneBtn: { flex: 1, padding: 16, alignItems: 'center', borderRadius: 12, backgroundColor: '#FD8A8A' },
  modalDoneText: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#fff' },
});
