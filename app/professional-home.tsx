import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

export default function ProfessionalHomeScreen() {
  const { openFolders } = useLocalSearchParams<{ openFolders?: string }>();

  useEffect(() => {
    router.replace({
      pathname: '/viral-professional-home',
      params: openFolders ? { openFolders } : {},
    });
  }, []);

  return <View />;
}
