import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SF_PRO } from '@/lib/onboarding-theme';

interface Props {
  visible: boolean;
  onRenew: () => void;
  onDismiss: () => void;
}

export function PaymentWarningModal({ visible, onRenew, onDismiss }: Props) {
  const { width } = useWindowDimensions();
  const pulse = useRef(new Animated.Value(1)).current;
  const slideUp = useRef(new Animated.Value(60)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [visible]);

  const cardWidth = Math.min(width * 0.88, 360);
  const bellSize = Math.round(cardWidth * 0.22);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <Animated.View style={[styles.overlay, { opacity: fadeIn }]}>
        <Animated.View style={[styles.card, { width: cardWidth, transform: [{ translateY: slideUp }] }]}>

          {/* Bell icon */}
          <Animated.View style={[styles.bellWrap, { width: bellSize * 1.6, height: bellSize * 1.6, borderRadius: bellSize, transform: [{ scale: pulse }] }]}>
            <Ionicons name="notifications" size={bellSize} color="#FD8A8A" />
          </Animated.View>

          <Text style={styles.title}>Your access is ending soon</Text>
          <Text style={styles.body}>
            Your Notario subscription has a pending payment. Fix your payment to keep your streak, notes, and study sets.
          </Text>

          <View style={styles.pillRow}>
            <View style={styles.pill}><Text style={styles.pillText}>🔥 Keep your streak</Text></View>
            <View style={styles.pill}><Text style={styles.pillText}>📚 Keep your notes</Text></View>
          </View>

          <Pressable style={styles.renewBtn} onPress={onRenew}>
            <Text style={styles.renewText}>Fix Payment</Text>
          </Pressable>

          <Pressable style={styles.dismissBtn} onPress={onDismiss}>
            <Text style={styles.dismissText}>Remind me later</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#1A1A2E',
    borderRadius: 28,
    paddingVertical: 36,
    paddingHorizontal: 28,
    alignItems: 'center',
    shadowColor: '#FD8A8A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 16,
  },
  bellWrap: {
    backgroundColor: 'rgba(253,138,138,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(253,138,138,0.25)',
  },
  title: {
    fontFamily: SF_PRO,
    fontSize: 22,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontFamily: SF_PRO,
    fontSize: 15,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 28,
  },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  pillText: {
    fontFamily: SF_PRO,
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
  },
  renewBtn: {
    backgroundColor: '#FD8A8A',
    borderRadius: 50,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignSelf: 'stretch',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CA6E6E',
    shadowColor: '#FD8A8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 14,
  },
  renewText: {
    fontFamily: SF_PRO,
    fontSize: 18,
    color: '#fff',
  },
  dismissBtn: {
    paddingVertical: 8,
  },
  dismissText: {
    fontFamily: SF_PRO,
    fontSize: 15,
    color: 'rgba(255,255,255,0.4)',
  },
});
