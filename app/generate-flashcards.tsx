import { StyleSheet, Text, View } from 'react-native';
import { OFF_WHITE, DEEP_BLACK, SF_PRO } from '@/lib/onboarding-theme';

export default function GenerateFlashcardsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Generate AI Flashcards</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: OFF_WHITE },
  title: { fontFamily: SF_PRO, fontSize: 24, color: DEEP_BLACK },
});
