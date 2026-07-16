import { useEffect } from 'react';
import { router } from 'expo-router';
import { setShowAddSheet } from '@/lib/add-sheet-store';

export default function CreateScreen() {
  useEffect(() => {
    setShowAddSheet(true);
    router.navigate('/(tabs)');
  }, []);

  return null;
}
