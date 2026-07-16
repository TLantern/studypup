import React, { useCallback } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import type { CustomerInfo, PurchasesError } from 'react-native-purchases';
import { getRevenueCatUI, revenueCatUIAvailable } from '@/lib/revenuecat';

interface PaywallModalProps {
  visible: boolean;
  onDismiss: () => void;
  onPurchaseCompleted?: (customerInfo: CustomerInfo) => void;
  onRestoreCompleted?: (customerInfo: CustomerInfo) => void;
  onPurchaseError?: (error: PurchasesError) => void;
}

/**
 * Full-screen RevenueCat Paywall inside a React Native Modal.
 * Renders nothing when the native UI module isn't available (Expo Go / web).
 *
 * Usage:
 *   const [paywallOpen, setPaywallOpen] = useState(false);
 *   <RevenueCatPaywallModal
 *     visible={paywallOpen}
 *     onDismiss={() => setPaywallOpen(false)}
 *     onPurchaseCompleted={(info) => console.log('Pro!', info.activeSubscriptions)}
 *   />
 */
export function RevenueCatPaywallModal({
  visible,
  onDismiss,
  onPurchaseCompleted,
  onRestoreCompleted,
  onPurchaseError,
}: PaywallModalProps) {
  const RevenueCatUI = getRevenueCatUI();
  if (!revenueCatUIAvailable || !RevenueCatUI) return null;

  const Paywall = RevenueCatUI.Paywall;

  const handlePurchaseCompleted = useCallback(
    ({ customerInfo }: { customerInfo: CustomerInfo }) => {
      onPurchaseCompleted?.(customerInfo);
      onDismiss();
    },
    [onPurchaseCompleted, onDismiss],
  );

  const handleRestoreCompleted = useCallback(
    ({ customerInfo }: { customerInfo: CustomerInfo }) => {
      onRestoreCompleted?.(customerInfo);
      onDismiss();
    },
    [onRestoreCompleted, onDismiss],
  );

  const handlePurchaseError = useCallback(
    ({ error }: { error: PurchasesError }) => {
      console.error('[RC Paywall] Purchase error:', error);
      onPurchaseError?.(error);
    },
    [onPurchaseError],
  );

  return (
    <Modal
      visible={visible}
      presentationStyle="pageSheet"
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={styles.container}>
        <Paywall
          onPurchaseCompleted={handlePurchaseCompleted}
          onPurchaseCancelled={onDismiss}
          onPurchaseError={handlePurchaseError}
          onRestoreCompleted={handleRestoreCompleted}
          onRestoreError={({ error }) =>
            console.error('[RC Paywall] Restore error:', error)
          }
          onDismiss={onDismiss}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
