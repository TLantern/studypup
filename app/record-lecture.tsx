import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function RecordLectureScreen() {
  const handleDelete = () => {
    console.log('Delete pressed');
  };

  const handlePlay = () => {
    console.log('Play pressed');
  };

  const handleConfirm = () => {
    console.log('Confirm pressed');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Record Lecture</Text>
      
      <View style={styles.buttonColumn}>
        <Pressable style={[styles.button, styles.deleteButton]} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={24} color="#000" />
          <Text style={[styles.buttonText, styles.deleteText]}>Delete</Text>
        </Pressable>

        <Pressable style={[styles.button, styles.playButton]} onPress={handlePlay}>
          <Ionicons name="play" size={24} color="#000" />
          <Text style={[styles.buttonText, styles.playText]}>Play</Text>
        </Pressable>

        <Pressable style={[styles.button, styles.confirmButton]} onPress={handleConfirm}>
          <Ionicons name="checkmark" size={24} color="#000" />
          <Text style={[styles.buttonText, styles.confirmText]}>Confirm</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#AADDDD' 
  },
  title: { 
    fontFamily: 'Fredoka_400Regular', 
    fontSize: 24, 
    marginBottom: 40 
  },
  buttonColumn: {
    gap: 16,
    width: '70%',
    maxWidth: 280,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  deleteButton: {
    backgroundColor: '#FF9B9B',
  },
  playButton: {
    backgroundColor: '#9CA3AF',
  },
  confirmButton: {
    backgroundColor: '#86EFAC',
  },
  buttonText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 18,
    fontWeight: '600',
  },
  deleteText: {
    color: '#000',
  },
  playText: {
    color: '#000',
  },
  confirmText: {
    color: '#000',
  },
});
