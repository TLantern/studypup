import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const QUICK_ACTIONS = [
  { id: 'flashcards', label: 'Generate AI Flashcards', icon: require('../../assets/genflashcard.png') },
  { id: 'homework', label: 'Homework Help', icon: require('../../assets/hwhelp.png') },
  { id: 'quiz', label: 'Generate Practice Quiz', icon: require('../../assets/genquiz.png') },
  { id: 'record', label: 'Record Lecture', icon: require('../../assets/lecturerec.png') },
];

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const JAN_2026 = Array.from({ length: 31 }, (_, i) => i + 1);

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const startOffset = 3;
  const today = 29;

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top + 16 }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Image source={require('../../assets/mainpup.png')} style={styles.avatar} />
        <View style={styles.streakBadge}>
          <Image source={require('../../assets/firestreak.png')} style={styles.streakIcon} />
          <Text style={styles.streakNum}>23</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable style={styles.proBtn}><Text style={styles.proText}>PRO</Text></Pressable>
          <Image source={require('../../assets/setting.png')} style={styles.settingIcon} />
        </View>
      </View>

      <View style={styles.streakCard}>
        <Image source={require('../../assets/firestreak.png')} style={styles.streakCardIcon} />
        <View style={styles.streakCardText}>
          <Text style={styles.streakDays}>23 Days</Text>
          <Text style={styles.streakLabel}>Streak Steps</Text>
        </View>
        <Text style={styles.streakCta}>Keep up your streak!</Text>
      </View>

      <View style={styles.calendar}>
        <View style={styles.calendarHeader}>
          <Text style={styles.calendarMonth}>JAN 2026</Text>
        </View>
        <View style={styles.daysRow}>
          {DAYS.map((d) => (
            <Text key={d} style={styles.dayLabel}>{d}</Text>
          ))}
        </View>
        <View style={styles.daysGrid}>
          {Array.from({ length: startOffset }, (_, i) => <View key={`e-${i}`} style={styles.dayCell} />)}
          {JAN_2026.map((d) => (
            <View key={d} style={[styles.dayCell, d === today && styles.dayToday]}>
              <Text style={[styles.dayNum, d === today && styles.dayNumToday]}>{d}</Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickGrid}>
        {QUICK_ACTIONS.map((a) => (
          <Pressable key={a.id} style={styles.quickBtn}>
            <Image source={a.icon} style={styles.quickIcon} contentFit="contain" />
            <Text style={styles.quickLabel}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#AADDDD' },
  content: { paddingHorizontal: 20, paddingBottom: 100 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', marginLeft: 12 },
  streakIcon: { width: 24, height: 24 },
  streakNum: { fontFamily: 'Fredoka_400Regular', fontSize: 18, marginLeft: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', gap: 12 },
  proBtn: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  proText: { fontFamily: 'Fredoka_400Regular', fontSize: 14 },
  settingIcon: { width: 24, height: 24 },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5D0C5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  streakCardIcon: { width: 48, height: 48 },
  streakCardText: { marginLeft: 12 },
  streakDays: { fontFamily: 'Fredoka_400Regular', fontSize: 20, color: '#E85D04' },
  streakLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 14, color: '#666' },
  streakCta: { fontFamily: 'Fredoka_400Regular', fontSize: 16, marginLeft: 'auto' },
  calendar: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, marginBottom: 4 },
  calendarHeader: { alignItems: 'center', marginBottom: 8 },
  calendarMonth: { fontFamily: 'Fredoka_400Regular', fontSize: 18 },
  daysRow: { flexDirection: 'row', marginBottom: 4 },
  dayLabel: { flex: 1, fontFamily: 'Fredoka_400Regular', fontSize: 12, color: '#666', textAlign: 'center' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  dayToday: { backgroundColor: '#3b82f6', borderRadius: 20 },
  dayNum: { fontFamily: 'Fredoka_400Regular', fontSize: 14 },
  dayNumToday: { color: '#fff' },
  sectionTitle: { fontFamily: 'FredokaOne_400Regular', fontSize: 20, marginBottom: 12 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickBtn: {
    width: '47%',
    backgroundColor: '#FD8A8A',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
  },
  quickIcon: { width: 48, height: 48, marginBottom: 8 },
  quickLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 14, textAlign: 'center' },
});
