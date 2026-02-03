import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgressBar } from '@/components/ProgressBar';

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

type LocationOption = 'usa' | 'texas';

export default function WhereStudyScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<LocationOption | null>(null);

  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
        <ProgressBar progress={20} />
        <Text style={[styles.title, { marginTop: 24 }]}>Where do you study?</Text>

        <Pressable
          style={[styles.optionBtn, selected === 'usa' && styles.optionBtnSelected]}
          onPress={() => setSelected('usa')}
        >
          <Text style={styles.optionFlag}>🇺🇸</Text>
          <Text style={styles.optionText}>United States of America</Text>
        </Pressable>
        <Pressable
          style={[styles.optionBtn, selected === 'texas' && styles.optionBtnSelected]}
          onPress={() => setSelected('texas')}
        >
          <Image source={require('../assets/icons/texas.png')} style={styles.optionFlagImg} />
          <Text style={styles.optionText}>Texas</Text>
        </Pressable>

        <Image source={require('../assets/travelpup.png')} style={styles.puppy} contentFit="contain" />

        <View style={styles.buttons}>
          <Pressable
            style={[styles.continueBtn, !selected && styles.continueBtnDisabled]}
            onPress={() => selected && router.push('/grade-level')}
            disabled={!selected}
          >
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
  title: { fontFamily: 'FredokaOne_400Regular', fontSize: 28, color: '#000', textAlign: 'center', marginBottom: 24 },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    ...BUTTON_SHADOW,
  },
  optionBtnSelected: { borderColor: '#7c3aed', borderWidth: 2 },
  optionFlag: { fontSize: 28, marginRight: 12 },
  optionFlagImg: { width: 36, height: 24, marginRight: 12 },
  optionText: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#000', flex: 1 },
  continueBtnDisabled: { opacity: 0.6 },
  puppy: {
    flex: 1,
    width: '100%',
    maxHeight: 240,
    alignSelf: 'center',
    marginVertical: 24,
  },
  buttons: { paddingTop: 100 },
  continueBtn: {
    backgroundColor: '#FD8A8A',
    borderRadius: 35,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CA6E6E',
    ...BUTTON_SHADOW,
  },
  continueBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: 24, color: '#fff' },
});
