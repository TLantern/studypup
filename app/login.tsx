import { Text, View } from 'react-native';
import { SF_PRO } from '@/lib/onboarding-theme';

export default function LoginScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#AADDDD' }}>
      <Text style={{ fontFamily: SF_PRO, fontSize: 24 }}>Login — coming soon</Text>
    </View>
  );
}
