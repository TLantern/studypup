import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as StoreReview from 'expo-store-review';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-store';
import { deleteAllLocalKnowledgeGraphs } from '@/lib/knowledge-graph-storage';
import { deleteAllLocalMaterials } from '@/lib/study-materials-storage';
import { scaleFont, scaleSize } from '@/lib/responsive';

const SF_PRO = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { signOut, deleteUser } = useAuth();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Pressable onPress={() => router.back()} style={styles.closeBtn} hitSlop={12}>
          <Ionicons name="close" size={28} color="#000" />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + scaleSize(40) }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={styles.unlimitedBtn}
          onPress={() => router.push('/create-account' as any)}
        >
          <LinearGradient
            colors={['#0D9488', '#14B8A6', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.unlimitedText}>Get Unlimited</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>For You</Text>
        <View style={styles.section}>
          <Pressable
            style={styles.item}
            onPress={async () => {
              if (await StoreReview.hasAction()) {
                await StoreReview.requestReview();
              } else {
                Alert.alert('Thanks!', 'We appreciate your support!');
              }
            }}
          >
            <View style={styles.itemLeft}>
              <Ionicons name="star" size={22} color="#000" />
              <Text style={styles.itemText}>Give Notario 5 stars</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#999" />
          </Pressable>
          <Pressable
            style={styles.item}
            onPress={() => router.push('/notifications' as any)}
          >
            <View style={styles.itemLeft}>
              <Ionicons name="notifications" size={22} color="#000" />
              <Text style={styles.itemText}>Notifications</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#999" />
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Support & feedback</Text>
        <View style={styles.section}>
          <Pressable
            style={styles.item}
            onPress={() => Linking.openURL('https://studystudypup.lovable.app/support')}
          >
            <View style={styles.itemLeft}>
              <Ionicons name="chatbox" size={22} color="#000" />
              <Text style={styles.itemText}>Help Center</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#999" />
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.section}>
          <Pressable
            style={styles.item}
            onPress={() => {
              Alert.alert(
                'Delete All Notes',
                'Remove all study materials and notes from this device? This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete All',
                    style: 'destructive',
                    onPress: async () => {
                      await deleteAllLocalMaterials();
                      await deleteAllLocalKnowledgeGraphs();
                    },
                  },
                ]
              );
            }}
          >
            <View style={styles.itemLeft}>
              <Ionicons name="trash" size={22} color="#FF4444" />
              <Text style={[styles.itemText, { color: '#FF4444' }]}>Delete all notes</Text>
            </View>
          </Pressable>
          <Pressable
            style={styles.item}
            onPress={() => Alert.alert('Restore Purchases', 'Restoring your purchases...', [{ text: 'OK' }])}
          >
            <View style={styles.itemLeft}>
              <Ionicons name="key" size={22} color="#000" />
              <Text style={styles.itemText}>Restore Purchases</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#999" />
          </Pressable>
          <Pressable
            style={styles.item}
            onPress={() => Linking.openURL('https://studystudypup.lovable.app/terms')}
          >
            <View style={styles.itemLeft}>
              <Ionicons name="lock-closed" size={22} color="#000" />
              <Text style={styles.itemText}>Terms of Service</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#999" />
          </Pressable>
          <Pressable
            style={styles.item}
            onPress={() => Linking.openURL('https://studystudypup.lovable.app/privacy')}
          >
            <View style={styles.itemLeft}>
              <Ionicons name="shield-checkmark" size={22} color="#000" />
              <Text style={styles.itemText}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#999" />
          </Pressable>
          <Pressable
            style={styles.item}
            onPress={() => {
              Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Sign Out',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await signOut();
                      router.replace('/');
                    } catch {
                      Alert.alert('Error', 'Failed to sign out. Please try again.');
                    }
                  },
                },
              ]);
            }}
          >
            <View style={styles.itemLeft}>
              <Ionicons name="power" size={22} color="#FF4444" />
              <Text style={[styles.itemText, { color: '#FF4444' }]}>Sign out</Text>
            </View>
          </Pressable>
          <Pressable
            style={styles.item}
            onPress={() => {
              Alert.alert(
                'Delete Account',
                'This action cannot be undone. All your data will be permanently deleted.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await deleteUser();
                        router.replace('/');
                      } catch {
                        Alert.alert('Error', 'Could not delete account. Sign out and back in, then try again.');
                      }
                    },
                  },
                ]
              );
            }}
          >
            <View style={styles.itemLeft}>
              <Ionicons name="warning" size={22} color="#FF4444" />
              <Text style={[styles.itemText, { color: '#FF4444' }]}>Delete account</Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F4' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scaleSize(20),
    paddingVertical: scaleSize(12),
  },
  title: { fontFamily: SF_PRO, fontSize: scaleFont(28), fontWeight: '700', color: '#000' },
  closeBtn: {
    width: scaleSize(40),
    height: scaleSize(40),
    borderRadius: scaleSize(20),
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlimitedBtn: {
    marginHorizontal: scaleSize(20),
    marginTop: scaleSize(8),
    height: scaleSize(56),
    borderRadius: scaleSize(16),
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlimitedText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(17),
    fontWeight: '700',
    color: '#FFF',
  },
  sectionTitle: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(13),
    fontWeight: '600',
    color: '#666',
    paddingHorizontal: scaleSize(20),
    marginTop: scaleSize(28),
    marginBottom: scaleSize(8),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    backgroundColor: '#FFF',
    marginHorizontal: scaleSize(20),
    borderRadius: scaleSize(14),
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scaleSize(16),
    paddingVertical: scaleSize(14),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: scaleSize(12) },
  itemText: { fontFamily: SF_PRO, fontSize: scaleFont(16), color: '#000' },
});
