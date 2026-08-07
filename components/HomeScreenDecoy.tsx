import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSyncExternalStore } from 'react';
import { Image as RNImage, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { styles } from '@/app/(tabs)/index';
import { getHomeSnapshot, subscribeHomeSnapshot } from '@/lib/home-snapshot-store';
import { getMasteryColor } from '@/lib/notes';
import { OFF_WHITE } from '@/lib/onboarding-theme';

/**
 * Non-interactive visual copy of the Home tab, used as the background behind the
 * Upload Content sheet on the Create tab so it looks like the sheet opened over Home.
 */
export function HomeScreenDecoy() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isTablet = screenWidth > 600;
  const contentPadding = isTablet ? 40 : 20;
  const { notes, weekStats } = useSyncExternalStore(subscribeHomeSnapshot, getHomeSnapshot, getHomeSnapshot);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]} pointerEvents="none">
      <LinearGradient
        colors={[OFF_WHITE, 'rgba(163, 191, 254, 0.06)', OFF_WHITE]}
        locations={[0, 0.25, 1]}
        style={{
          position: 'absolute',
          top: screenHeight * 0.25,
          left: 0,
          right: 0,
          height: screenHeight * 0.65,
        }}
      />
      <View style={[styles.header, { paddingHorizontal: contentPadding }]}>
        <View style={styles.headerLeft}>
          <Image
            source={require('../assets/images/notariomainicon.png')}
            style={styles.notarioHeaderIcon}
            contentFit="contain"
          />
          <Text style={styles.notarioHeaderTitle}>Notario</Text>
        </View>
        <View style={styles.headerRight}>
          <Image source={require('../assets/search.png')} style={styles.headerIcon} />
        </View>
      </View>
      <View style={styles.headerDivider} />

      <View style={[styles.content, { paddingHorizontal: contentPadding }]}>
        {notes.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <View style={styles.card}>
              <Text style={[styles.cardTitle, { fontSize: isTablet ? 28 : 20 }]}>Create Your First Study Set</Text>
              <Text style={[styles.cardDesc, { fontSize: isTablet ? 20 : 16 }]}>
                Transform your study materials into methods that actually work.
              </Text>
              <View style={[styles.continueBtnWrap, styles.continueBtn, { backgroundColor: '#0D0D0F' }]}>
                <Text style={styles.continueBtnText}>Continue</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.notesContainer}>
            <View style={styles.weekCard}>
              <View style={styles.weekDaysRow}>
                {weekStats.map(({ label, date, isToday, isFuture, studied }, i) => (
                  <View key={i} style={[styles.weekDayCol, isToday && styles.weekDayColToday]}>
                    <Text style={[styles.weekDayLabel, isToday && styles.weekDayLabelToday]}>{label}</Text>
                    {studied ? (
                      <View style={styles.weekDayCircle}>
                        <Text style={styles.weekCheckmark}>✓</Text>
                      </View>
                    ) : (
                      <View style={[styles.weekDayDotted, isToday && styles.weekDayDottedToday]}>
                        <Text style={[styles.weekDayDate, isFuture && styles.weekDayDateFuture]}>{date}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>

            <Text style={[styles.myNotesTitle, { fontSize: isTablet ? 36 : 28 }]}>My Notes</Text>

            {notes.map((note) => (
              <View key={note.id} style={styles.noteCard}>
                <View style={styles.noteCardInner}>
                  <View style={styles.noteEmojiContainer}>
                    <Text style={styles.noteEmoji}>{note.emoji}</Text>
                  </View>
                  <View style={styles.noteDetails}>
                    <Text style={styles.noteName}>{note.name}</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <View>
                        <Text style={styles.noteDate}>{note.date}</Text>
                        <Text style={styles.noteMastery}>Mastery: {note.mastery}%</Text>
                      </View>
                      <View style={styles.viewReportBtn}>
                        <Text style={styles.viewReportText}>View Report</Text>
                        <RNImage source={require('../assets/icons/arrow-right.png')} style={styles.viewReportArrow} />
                      </View>
                    </View>
                    <View style={styles.progressBarContainer}>
                      <View
                        style={[
                          styles.progressBar,
                          { width: `${note.mastery}%`, backgroundColor: getMasteryColor(note.mastery) },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
