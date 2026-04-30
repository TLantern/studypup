import { StyleSheet, Text, View } from 'react-native';
import { SF_PRO } from '@/lib/onboarding-theme';

export default function LibraryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Library</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#AADDDD' },
  title: { fontFamily: SF_PRO, fontSize: 24 },
});
