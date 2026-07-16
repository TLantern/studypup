import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { ACCENT_BLUE } from '@/lib/onboarding-theme';

export default function TabsLayout() {
  return (
    <NativeTabs tintColor={ACCENT_BLUE}>
      <NativeTabs.Trigger name="index">
        <Label>Home</Label>
        <Icon
          sf={{ default: 'house', selected: 'house.fill' }}
          androidSrc={require('../../assets/home.png')}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="library">
        <Label>Library</Label>
        <Icon
          sf={{ default: 'books.vertical', selected: 'books.vertical.fill' }}
          androidSrc={require('../../assets/library.png')}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="create">
        <Label>Create</Label>
        <Icon
          sf={{ default: 'plus.circle', selected: 'plus.circle.fill' }}
          androidSrc={require('../../assets/plus-circle.png')}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Label>Profile</Label>
        <Icon
          sf={{ default: 'person', selected: 'person.fill' }}
          androidSrc={require('../../assets/profile.png')}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
