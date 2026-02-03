const memoryStore: Record<string, string> = {};

export async function setItem(key: string, value: string): Promise<void> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem(key, value);
  } catch {
    memoryStore[key] = value;
  }
}

export async function getItem(key: string): Promise<string | null> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    return await AsyncStorage.getItem(key);
  } catch {
    return memoryStore[key] ?? null;
  }
}
