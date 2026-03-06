import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  applyNotifPrefs,
  getNotifPrefs,
  NotifPrefs,
  requestPermissions,
  saveNotifPrefs,
} from '@/lib/notifications';

const ITEMS: { key: keyof NotifPrefs; label: string; sub: string }[] = [
  { key: 'dailyReminder', label: 'Daily Reminder', sub: 'Every day at 7:00 PM' },
  { key: 'streakProtection', label: 'Streak Protection', sub: 'Every day at 8:00 PM' },
  { key: 'spacedRepetition', label: 'Spaced Repetition', sub: '3 days after last review' },
  { key: 'weeklySummary', label: 'Weekly Check-in', sub: 'Every Sunday at 7:00 PM' },
];

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const [prefs, setPrefs] = useState<NotifPrefs>({
    dailyReminder: true,
    streakProtection: true,
    spacedRepetition: true,
    weeklySummary: true,
  });
  const [permitted, setPermitted] = useState(true);

  useEffect(() => {
    (async () => {
      const loaded = await getNotifPrefs();
      setPrefs(loaded);
    })();
  }, []);

  async function toggle(key: keyof NotifPrefs, value: boolean) {
    if (value && !permitted) {
      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert('Permission needed', 'Enable notifications in Settings to use this feature.');
        return;
      }
      setPermitted(true);
    }
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    await saveNotifPrefs(updated);
    await applyNotifPrefs(updated);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#000" />
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Engagement</Text>
        <View style={styles.section}>
          {ITEMS.map((item, i) => (
            <View
              key={item.key}
              style={[styles.row, i < ITEMS.length - 1 && styles.rowBorder]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowSub}>{item.sub}</Text>
              </View>
              <Switch
                value={prefs[item.key]}
                onValueChange={v => toggle(item.key, v)}
                trackColor={{ true: '#FD8A8A', false: '#E0E0E0' }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  title: { fontFamily: 'FredokaOne_400Regular', fontSize: 22, color: '#000' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionTitle: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: '#666',
    marginTop: 24,
    marginBottom: 12,
    marginLeft: 4,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  rowText: { flex: 1, marginRight: 12 },
  rowLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#000' },
  rowSub: { fontFamily: 'Fredoka_400Regular', fontSize: 13, color: '#999', marginTop: 2 },
});
