import { useFonts, Fredoka_400Regular } from '@expo-google-fonts/fredoka';
import { FredokaOne_400Regular } from '@expo-google-fonts/fredoka-one';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Fredoka_400Regular, FredokaOne_400Regular });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="login" options={{ headerShown: true, title: 'Login' }} />
      </Stack>
    </View>
  );
}
