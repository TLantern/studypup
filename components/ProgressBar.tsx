import { StyleSheet, View } from 'react-native';

const FILL_COLOR = 'rgba(253, 138, 138, 0.8)';

export function ProgressBar({ progress }: { progress: number }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, progress))}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, backgroundColor: 'rgba(0,0,0,0.12)', width: '100%', borderRadius: 4 },
  fill: { height: '100%', backgroundColor: FILL_COLOR, borderRadius: 4 },
});
