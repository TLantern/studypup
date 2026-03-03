import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { getStoredPhoneNumber, getStoredUserData, clearStoredAuthData } from './auth-store';

/**
 * Development utility component for debugging auth persistence.
 * Only include this in development builds or when explicitly needed for testing.
 */
export function AuthDebugPanel() {
  const [storedPhone, setStoredPhone] = useState<string | null>(null);
  const [storedUserData, setStoredUserData] = useState<any>(null);

  const loadStoredData = async () => {
    const phone = await getStoredPhoneNumber();
    const userData = await getStoredUserData();
    setStoredPhone(phone);
    setStoredUserData(userData);
  };

  useEffect(() => {
    loadStoredData();
  }, []);

  const handleClearData = async () => {
    Alert.alert(
      'Clear Stored Auth Data',
      'This will clear all stored authentication data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearStoredAuthData();
            await loadStoredData();
            Alert.alert('Success', 'Stored auth data cleared');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Auth Debug Panel</Text>
      
      <View style={styles.section}>
        <Text style={styles.label}>Stored Phone:</Text>
        <Text style={styles.value}>{storedPhone || 'None'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Stored User Data:</Text>
        <Text style={styles.value}>
          {storedUserData ? JSON.stringify(storedUserData, null, 2) : 'None'}
        </Text>
      </View>

      <View style={styles.buttons}>
        <Pressable style={styles.button} onPress={loadStoredData}>
          <Text style={styles.buttonText}>Refresh</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.clearButton]} onPress={handleClearData}>
          <Text style={[styles.buttonText, styles.clearButtonText]}>Clear Data</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ff0000',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff0000',
    textAlign: 'center',
    marginBottom: 16,
  },
  section: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  value: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 4,
    fontFamily: 'monospace',
  },
  buttons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  button: {
    flex: 1,
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#dc3545',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  clearButtonText: {
    color: '#fff',
  },
});