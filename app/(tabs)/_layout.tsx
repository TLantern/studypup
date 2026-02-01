import { Tabs } from 'expo-router';
import { Image } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#000',
        tabBarInactiveTintColor: '#666',
        tabBarLabelStyle: { fontFamily: 'Fredoka_400Regular', fontSize: 12 },
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#eee' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Image source={require('../../assets/home.png')} style={{ width: 24, height: 24, tintColor: color }} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ color }) => <Image source={require('../../assets/library.png')} style={{ width: 24, height: 24, tintColor: color }} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarIcon: () => <Image source={require('../../assets/createbutton.png')} style={{ width: 48, height: 48 }} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Image source={require('../../assets/profile.png')} style={{ width: 24, height: 24, tintColor: color }} />,
        }}
      />
    </Tabs>
  );
}
