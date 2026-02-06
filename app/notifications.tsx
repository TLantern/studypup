import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    const timer = setTimeout(() => {
      Notifications.requestPermissionsAsync();
    }, 1500);
    return () => clearTimeout(timer);
  }, []);
  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.title}>Stay on Track</Text>
        <Text style={styles.subtext}>Get reminders to study and never miss a test date.</Text>
        <View style={styles.bellContainer}>
          <Image source={require('../assets/faintelipse.png')} style={styles.faintElipse} contentFit="contain" />
          <Image source={require('../assets/solidelipse.png')} style={styles.solidElipse} contentFit="contain" />
          <Image source={require('../assets/icons/notification.png')} style={styles.bell} contentFit="contain" />
        </View>
        <View style={styles.bottomSection}>
          <Image source={require('../assets/buttonpup.png')} style={styles.puppy} contentFit="contain" />
          <Pressable style={styles.continueBtn} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.continueBtnText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24 },
  title: { fontFamily: 'FredokaOne_400Regular', fontSize: 32, color: '#000', textAlign: 'center', marginBottom: 8 },
  subtext: { fontFamily: 'Fredoka_400Regular', fontSize: 18, color: '#333', textAlign: 'center', marginBottom: 32 },
  bellContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  faintElipse: { position: 'absolute', width: 280, height: 280 },
  solidElipse: { position: 'absolute', width: 200, height: 200 },
  bell: { position: 'absolute', width: 120, height: 120 },
  bottomSection: { marginTop: 'auto', paddingTop: 16, position: 'relative', alignItems: 'center' },
  puppy: { position: 'absolute', bottom: 51, width: 140, height: 120, zIndex: 1 },
  continueBtn: {
    backgroundColor: '#FD8A8A',
    borderRadius: 35,
    paddingVertical: 18,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CA6E6E',
    ...BUTTON_SHADOW,
  },
  continueBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: 24, color: '#fff' },
});
