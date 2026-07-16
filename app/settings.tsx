import { router } from 'expo-router';
import { SettingsContent } from '@/components/SettingsContent';

export default function SettingsScreen() {
  return <SettingsContent onClose={() => router.replace('/(tabs)')} />;
}
