import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { setShowAddSheet } from '@/lib/add-sheet-store';
import { HomeScreenDecoy } from '@/components/HomeScreenDecoy';

export default function CreateScreen() {
  useFocusEffect(
    useCallback(() => {
      setShowAddSheet(true);
      return () => setShowAddSheet(false);
    }, [])
  );

  return <HomeScreenDecoy />;
}
