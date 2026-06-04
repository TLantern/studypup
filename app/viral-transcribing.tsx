import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { callOpenAI } from '@/lib/openai-service';
import { getProNoteById } from '@/lib/pro-note-store';
import { scaleFont, scaleSize } from '@/lib/responsive';

const SF_PRO = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });
const DEEP_BLACK = '#0D0D0F';

export default function ViralTranscribingScreen() {
  const insets = useSafeAreaInsets();
  const { noteId } = useLocalSearchParams<{ noteId?: string }>();
  const [roast, setRoast] = useState<string | null>(null);

  useEffect(() => {
    if (!noteId) return;
    const note = getProNoteById(noteId);
    if (!note) return;

    const context = note.transcript
      ? note.transcript.slice(0, 3000)
      : `${note.title}. ${note.subtitle}`;

    callOpenAI<{ line1: string; line2: string }>(
      'You are a sharp, deadpan comedian. Return only valid JSON — no markdown, no code fences.',
      `Based on this meeting/recording, write a 2-line roast that's funny and relatable — poke fun at how boring, unnecessary, or pointless this was (like it could've been an email or a Slack message). Keep it clever and light, max 15 words per line.

Return JSON: { "line1": "...", "line2": "..." }

Meeting content: ${context}`
    ).then((r) => setRoast(`${r.line1}\n${r.line2}`)).catch(() => {
      setRoast("Another meeting that could've been an email.\nAt least the notes are done now.");
    });
  }, [noteId]);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Pressable
        style={({ pressed }) => [styles.continueBtn, pressed && { opacity: 0.75 }]}
        onPress={() => router.push({ pathname: '/viral-professional-note-detail', params: noteId ? { generated: '1', noteId } : {} })}
      >
        <Text style={styles.continueBtnText}>Continue</Text>
      </Pressable>

      <View style={styles.orbWrap}>
        <LinearGradient
          colors={['#3B82F6', '#93C5FD', '#DBEAFE']}
          start={{ x: 0.15, y: 0.85 }}
          end={{ x: 0.85, y: 0.1 }}
          style={styles.orb}
        />
      </View>

      {roast ? (
        <Text style={styles.roastText}>{roast}</Text>
      ) : (
        <Text style={styles.loadingText}>Roasting your meeting…</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scaleSize(32),
  },
  continueBtn: {
    position: 'absolute',
    top: scaleSize(56),
    right: scaleSize(24),
    backgroundColor: DEEP_BLACK,
    paddingHorizontal: scaleSize(20),
    paddingVertical: scaleSize(10),
    borderRadius: 999,
  },
  continueBtnText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  orbWrap: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 10,
    marginBottom: scaleSize(40),
  },
  orb: {
    width: scaleSize(160),
    height: scaleSize(160),
    borderRadius: scaleSize(80),
  },
  roastText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(18),
    fontWeight: '600',
    color: DEEP_BLACK,
    textAlign: 'center',
    lineHeight: scaleFont(26),
  },
  loadingText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
