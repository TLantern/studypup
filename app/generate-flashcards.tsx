import { StyleSheet, Text, View } from 'react-native';

export default function GenerateFlashcardsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Generate AI Flashcards</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#AADDDD' },
  title: { fontFamily: 'Fredoka_400Regular', fontSize: 24 },
});
