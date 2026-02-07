import LottieView from 'lottie-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const ROTATING_TEXTS = [
  'Analyzing your material…',
  'Extracting key concepts…',
  'Organizing notes for clarity…',
  'Generating study-ready insights…',
  'Finalizing your content…',
];

const TYPEWRITER_MS = 50;
const HOLD_MS = 2000;

type Props = {
  contentTypes: string[];
};

export function GeneratingContentScreen(_props: Props) {
  const [index, setIndex] = useState(0);
  const [displayed, setDisplayed] = useState('');
  const lottieRef = useRef<LottieView>(null);
  const phrase = ROTATING_TEXTS[index];

  useEffect(() => {
    setDisplayed('');
  }, [index]);

  useEffect(() => {
    if (displayed.length >= phrase.length) {
      const t = setTimeout(() => {
        setIndex((i) => (i + 1) % ROTATING_TEXTS.length);
      }, HOLD_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setDisplayed(phrase.slice(0, displayed.length + 1));
    }, TYPEWRITER_MS);
    return () => clearTimeout(t);
  }, [displayed, phrase]);

  useEffect(() => {
    lottieRef.current?.play();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{displayed}</Text>
      <View style={styles.lottieWrap}>
        <LottieView
          ref={lottieRef}
          source={require('../Astronaut_Dog.json')}
          style={styles.lottie}
          loop
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  text: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 22,
    color: '#333',
    textAlign: 'center',
    marginBottom: 32,
  },
  lottieWrap: {
    width: 280,
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottie: {
    width: 280,
    height: 280,
  },
});
