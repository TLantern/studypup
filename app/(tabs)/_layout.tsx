import { Tabs } from 'expo-router';
import { Image } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: 'rgba(0,0,0,0.6)',
        tabBarLabelStyle: { fontFamily: 'Fredoka_400Regular', fontSize: 12 },
        tabBarItemStyle: { justifyContent: 'center', alignItems: 'center' },
        tabBarStyle: { backgroundColor: '#FD8A8A', borderTopColor: 'transparent', paddingTop: 10 },
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
        options={{ href: null }}
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
