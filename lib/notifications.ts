import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { listAllMaterials } from './study-materials-storage';

const KEYS = {
  DAILY: 'notif_daily_id',
  STREAK: 'notif_streak_id',
  WEEKLY: 'notif_weekly_id',
  SR_PREFIX: 'notif_sr_',
  PREFS: 'notif_prefs',
  PAYMENT_1: 'notif_payment_1_id',
  PAYMENT_2: 'notif_payment_2_id',
  PAYMENT_3: 'notif_payment_3_id',
  PAYMENT_SCHEDULED: 'notif_payment_scheduled',
  HAD_ACTIVE_SUB: 'notif_had_active_sub',
};

export interface NotifPrefs {
  dailyReminder: boolean;
  streakProtection: boolean;
  spacedRepetition: boolean;
  weeklySummary: boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  dailyReminder: true,
  streakProtection: true,
  spacedRepetition: true,
  weeklySummary: true,
};

export async function getNotifPrefs(): Promise<NotifPrefs> {
  const raw = await AsyncStorage.getItem(KEYS.PREFS);
  return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
}

export async function saveNotifPrefs(prefs: NotifPrefs): Promise<void> {
  await AsyncStorage.setItem(KEYS.PREFS, JSON.stringify(prefs));
}

export async function requestPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function cancelStored(key: string): Promise<void> {
  const id = await AsyncStorage.getItem(key);
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    await AsyncStorage.removeItem(key);
  }
}

// #1 Daily Reminder — 7:00 PM every day
export async function scheduleDailyReminder(enable: boolean): Promise<void> {
  await cancelStored(KEYS.DAILY);
  if (!enable) return;
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to study! 📚',
      body: "Keep your momentum going — open a study set.",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: 19,
      minute: 0,
      repeats: true,
    },
  });
  await AsyncStorage.setItem(KEYS.DAILY, id);
}

// #2 Streak Protection — 8:00 PM every day
export async function scheduleStreakProtection(enable: boolean): Promise<void> {
  await cancelStored(KEYS.STREAK);
  if (!enable) return;
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Don't break your streak! 🔥",
      body: "You haven't studied today. Open Studypup before midnight!",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: 20,
      minute: 0,
      repeats: true,
    },
  });
  await AsyncStorage.setItem(KEYS.STREAK, id);
}

// #3 Spaced Repetition — 3 days after each set's updated_at
export async function refreshSpacedRepetitionNotifications(enable: boolean): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const srKeys = allKeys.filter(k => k.startsWith(KEYS.SR_PREFIX));
  await Promise.all(
    srKeys.map(async k => {
      const id = await AsyncStorage.getItem(k);
      if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    })
  );
  await AsyncStorage.multiRemove(srKeys);

  if (!enable) return;

  const materials = await listAllMaterials();
  const now = Date.now();
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

  for (const mat of materials.slice(0, 10)) {
    const fireAt = new Date(mat.updated_at).getTime() + THREE_DAYS_MS;
    if (fireAt <= now) continue;
    const label = [mat.emoji, mat.title].filter(Boolean).join(' ') || 'your study set';
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time to review! 🧠',
        body: `It's been 3 days since you studied ${label}. Don't forget!`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(fireAt),
      },
    });
    await AsyncStorage.setItem(`${KEYS.SR_PREFIX}${mat.id}`, id);
  }
}

// #6 Weekly Summary — Every Sunday at 7:00 PM
export async function scheduleWeeklySummary(enable: boolean): Promise<void> {
  await cancelStored(KEYS.WEEKLY);
  if (!enable) return;
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Weekly check-in 📊',
      body: "How was your study week? Open Studypup to review your progress.",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      weekday: 1, // Sunday (iOS: 1=Sun, 2=Mon…7=Sat)
      hour: 19,
      minute: 0,
      repeats: true,
    },
  });
  await AsyncStorage.setItem(KEYS.WEEKLY, id);
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Call when subscription becomes ACTIVE — records the fact + cancels any pending payment notifs
export async function markSubscriptionActive(): Promise<void> {
  await AsyncStorage.setItem(KEYS.HAD_ACTIVE_SUB, '1');
  await cancelStored(KEYS.PAYMENT_1);
  await cancelStored(KEYS.PAYMENT_2);
  await cancelStored(KEYS.PAYMENT_3);
  await AsyncStorage.removeItem(KEYS.PAYMENT_SCHEDULED);
}

// Returns true if we previously recorded an active subscription
export async function hadActiveSubscription(): Promise<boolean> {
  return !!(await AsyncStorage.getItem(KEYS.HAD_ACTIVE_SUB));
}

// 3 escalating notifications: +1h, +24h, +48h
export async function schedulePaymentWarningNotifications(): Promise<void> {
  const alreadyScheduled = await AsyncStorage.getItem(KEYS.PAYMENT_SCHEDULED);
  if (alreadyScheduled) return;
  const now = Date.now();
  const [id1, id2, id3] = await Promise.all([
    Notifications.scheduleNotificationAsync({
      content: { title: 'Your access is ending soon ⚠️', body: 'Renew your StudyPup subscription to keep studying.', sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(now + HOUR) },
    }),
    Notifications.scheduleNotificationAsync({
      content: { title: "Don't lose your streak! 🔥", body: 'Renew now to keep your progress and streak alive.', sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(now + DAY) },
    }),
    Notifications.scheduleNotificationAsync({
      content: { title: 'Your access has expired 😢', body: 'Come back to StudyPup — your notes are waiting for you.', sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(now + 2 * DAY) },
    }),
  ]);
  await AsyncStorage.multiSet([
    [KEYS.PAYMENT_1, id1],
    [KEYS.PAYMENT_2, id2],
    [KEYS.PAYMENT_3, id3],
    [KEYS.PAYMENT_SCHEDULED, '1'],
  ]);
}

export async function cancelPaymentWarningNotifications(): Promise<void> {
  await cancelStored(KEYS.PAYMENT_1);
  await cancelStored(KEYS.PAYMENT_2);
  await cancelStored(KEYS.PAYMENT_3);
  await AsyncStorage.removeItem(KEYS.PAYMENT_SCHEDULED);
}

export async function applyNotifPrefs(prefs: NotifPrefs): Promise<void> {
  await Promise.all([
    scheduleDailyReminder(prefs.dailyReminder),
    scheduleStreakProtection(prefs.streakProtection),
    refreshSpacedRepetitionNotifications(prefs.spacedRepetition),
    scheduleWeeklySummary(prefs.weeklySummary),
  ]);
}
