import { StyleSheet, Text, View } from 'react-native';

export default function HomeworkHelpScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Homework Help</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#AADDDD' },
  title: { fontFamily: 'Fredoka_400Regular', fontSize: 24 },
});
