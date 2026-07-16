import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticSelect } from '@/lib/haptics';
import { scaleFont, scaleSize } from '@/lib/responsive';
import { useSalesCall, formatCallDuration } from '@/lib/twilio-voice';

const BG = '#F2F2F4';
const CARD = '#FFFFFF';
const DEEP_BLACK = '#0D0D0F';
const SUBTITLE_GRAY = '#6B7280';
const SF_PRO = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

const DIALPAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

export default function SalesDialerScreen() {
  const insets = useSafeAreaInsets();
  const [number, setNumber] = useState('');
  const [muted, setMuted] = useState(false);
  const { callState, activeCall, duration, placeCall, hangUp, toggleMute } = useSalesCall();

  const isActive = callState !== 'idle' && callState !== 'disconnected';

  const handleDigit = useCallback((digit: string) => {
    hapticSelect();
    setNumber((n) => n + digit);
  }, []);

  const handleBackspace = useCallback(() => {
    hapticSelect();
    setNumber((n) => n.slice(0, -1));
  }, []);

  const handleCall = useCallback(() => {
    if (!number.trim()) return;
    hapticSelect();
    placeCall(number.trim());
  }, [number, placeCall]);

  const handleHangUp = useCallback(() => {
    hapticSelect();
    hangUp();
  }, [hangUp]);

  const handleMute = useCallback(() => {
    hapticSelect();
    const next = !muted;
    setMuted(next);
    toggleMute(next);
  }, [muted, toggleMute]);

  const callStatusLabel = {
    idle: '',
    connecting: 'Connecting…',
    ringing: 'Ringing…',
    connected: formatCallDuration(duration),
    disconnected: 'Call ended',
  }[callState];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={scaleFont(26)} color={DEEP_BLACK} />
        </Pressable>
        <Text style={styles.headerTitle}>Sales Call</Text>
        <View style={{ width: scaleSize(32) }} />
      </View>

      {/* Number display */}
      <View style={styles.displayWrap}>
        {isActive ? (
          <>
            <Text style={styles.callNumber}>{activeCall?.to ?? number}</Text>
            <Text style={styles.callStatus}>{callStatusLabel}</Text>
          </>
        ) : (
          <View style={styles.inputRow}>
            <TextInput
              value={number}
              onChangeText={setNumber}
              placeholder="Enter number"
              placeholderTextColor={SUBTITLE_GRAY}
              style={styles.numberInput}
              keyboardType="phone-pad"
              editable={!isActive}
            />
            {number.length > 0 && (
              <Pressable hitSlop={12} onPress={handleBackspace}>
                <Ionicons name="backspace-outline" size={scaleFont(24)} color={SUBTITLE_GRAY} />
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Dialpad — hidden during active call */}
      {!isActive && (
        <View style={styles.dialpad}>
          {DIALPAD.map((row, r) => (
            <View key={r} style={styles.dialRow}>
              {row.map((digit) => (
                <Pressable
                  key={digit}
                  style={({ pressed }) => [styles.dialBtn, pressed && { opacity: 0.6 }]}
                  onPress={() => handleDigit(digit)}
                >
                  <Text style={styles.dialDigit}>{digit}</Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      )}

      {/* Active call controls */}
      {isActive && (
        <View style={styles.activeControls}>
          <Pressable
            style={[styles.controlBtn, muted && styles.controlBtnActive]}
            onPress={handleMute}
          >
            <Ionicons
              name={muted ? 'mic-off' : 'mic'}
              size={scaleFont(26)}
              color={muted ? '#FFFFFF' : DEEP_BLACK}
            />
            <Text style={[styles.controlLabel, muted && { color: '#FFFFFF' }]}>
              {muted ? 'Unmute' : 'Mute'}
            </Text>
          </Pressable>

          <View style={styles.controlBtn}>
            <Ionicons name="recording" size={scaleFont(26)} color="#22C55E" />
            <Text style={[styles.controlLabel, { color: '#22C55E' }]}>Recording</Text>
          </View>
        </View>
      )}

      {/* Call / Hang-up button */}
      <View style={[styles.callBtnWrap, { paddingBottom: insets.bottom + scaleSize(24) }]}>
        {isActive ? (
          <Pressable style={styles.hangUpBtn} onPress={handleHangUp}>
            <Ionicons name="call" size={scaleFont(30)} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </Pressable>
        ) : (
          <Pressable
            style={[styles.callBtn, !number.trim() && styles.callBtnDisabled]}
            onPress={handleCall}
            disabled={!number.trim()}
          >
            <Ionicons name="call" size={scaleFont(30)} color="#FFFFFF" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scaleSize(20),
    paddingVertical: scaleSize(12),
  },
  headerTitle: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(17),
    fontWeight: '600',
    color: DEEP_BLACK,
  },
  displayWrap: {
    alignItems: 'center',
    paddingVertical: scaleSize(32),
    paddingHorizontal: scaleSize(24),
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(12),
    backgroundColor: CARD,
    borderRadius: scaleSize(16),
    paddingHorizontal: scaleSize(20),
    paddingVertical: scaleSize(14),
    width: '100%',
  },
  numberInput: {
    flex: 1,
    fontFamily: SF_PRO,
    fontSize: scaleFont(28),
    fontWeight: '600',
    color: DEEP_BLACK,
    padding: 0,
    letterSpacing: 2,
  },
  callNumber: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(32),
    fontWeight: '700',
    color: DEEP_BLACK,
    letterSpacing: 1,
    marginBottom: scaleSize(8),
  },
  callStatus: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(18),
    color: SUBTITLE_GRAY,
    fontWeight: '500',
  },
  dialpad: {
    paddingHorizontal: scaleSize(40),
    gap: scaleSize(8),
  },
  dialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: scaleSize(8),
  },
  dialBtn: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: scaleSize(16),
    height: scaleSize(64),
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialDigit: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(24),
    fontWeight: '600',
    color: DEEP_BLACK,
  },
  activeControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: scaleSize(24),
    paddingHorizontal: scaleSize(40),
    paddingTop: scaleSize(40),
  },
  controlBtn: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: scaleSize(20),
    paddingVertical: scaleSize(20),
    alignItems: 'center',
    gap: scaleSize(8),
  },
  controlBtnActive: {
    backgroundColor: DEEP_BLACK,
  },
  controlLabel: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(13),
    fontWeight: '600',
    color: DEEP_BLACK,
  },
  callBtnWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  callBtn: {
    width: scaleSize(72),
    height: scaleSize(72),
    borderRadius: scaleSize(36),
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  callBtnDisabled: {
    opacity: 0.4,
  },
  hangUpBtn: {
    width: scaleSize(72),
    height: scaleSize(72),
    borderRadius: scaleSize(36),
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
