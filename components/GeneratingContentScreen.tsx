import LottieView from 'lottie-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const TYPEWRITER_MS = 45;
const HOLD_MS = 1800;

type Props = {
  contentTypes: string[];
  contentName?: string;
  materialTitle?: string | null;
};

function phase1Texts(contentName?: string): string[] {
  const name = contentName ? contentName.replace(/(\.[a-zA-Z0-9]{1,5})+$/, '') : null;
  return [
    name ? `Reading "${name}"…` : 'Analyzing your material…',
    'Pulling out the key concepts…',
    name ? `Breaking down "${name}"…` : 'Organizing your notes…',
    'Identifying what matters most…',
    'Almost there…',
  ];
}

function phase2Texts(materialTitle: string): string[] {
  return [
    `Looks like you're studying ${materialTitle}…`,
    `Building your study set for ${materialTitle}…`,
    'Putting the final touches on…',
  ];
}

export function GeneratingContentScreen({ contentName, materialTitle }: Props) {
  const [texts, setTexts] = useState<string[]>(() => phase1Texts(contentName));
  const [index, setIndex] = useState(0);
  const [displayed, setDisplayed] = useState('');
  const lottieRef = useRef<LottieView>(null);

  // Switch to phase 2 when materialTitle arrives
  useEffect(() => {
    if (!materialTitle) return;
    const next = phase2Texts(materialTitle);
    setTexts(next);
    setIndex(0);
    setDisplayed('');
  }, [materialTitle]);

  const phrase = texts[index] ?? '';

  useEffect(() => {
    setDisplayed('');
  }, [index]);

  useEffect(() => {
    if (displayed.length >= phrase.length) {
      const t = setTimeout(() => {
        setIndex((i) => Math.min(i + 1, texts.length - 1));
      }, HOLD_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setDisplayed(phrase.slice(0, displayed.length + 1));
    }, TYPEWRITER_MS);
    return () => clearTimeout(t);
  }, [displayed, phrase, texts.length]);

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
