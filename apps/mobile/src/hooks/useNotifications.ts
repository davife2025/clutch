import { useEffect, useRef, useState } from 'react'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { getToken } from '../lib/api'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001'

// Configure how notifications appear when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
})

export interface UseNotificationsResult {
  expoPushToken:  string | null
  notification:   Notifications.Notification | null
  permissionStatus: 'granted' | 'denied' | 'undetermined'
  requestPermission: () => Promise<boolean>
}

export function useNotifications(): UseNotificationsResult {
  const [expoPushToken, setExpoPushToken]     = useState<string | null>(null)
  const [notification, setNotification]       = useState<Notifications.Notification | null>(null)
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined')
  const notificationListener = useRef<Notifications.Subscription>()
  const responseListener     = useRef<Notifications.Subscription>()

  useEffect(() => {
    // Listen for incoming notifications
    notificationListener.current = Notifications.addNotificationReceivedListener((n) => {
      setNotification(n)
    })

    // Listen for notification taps
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data
      // Navigation handled by the app router based on data.category
      console.log('[notifications] tapped:', data)
    })

    return () => {
      notificationListener.current?.remove()
      responseListener.current?.remove()
    }
  }, [])

  async function requestPermission(): Promise<boolean> {
    if (!Device.isDevice) {
      console.warn('[notifications] Push tokens only work on physical devices')
      return false
    }

    const { status: existing } = await Notifications.getPermissionsAsync()
    let finalStatus = existing

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    setPermissionStatus(finalStatus as any)

    if (finalStatus !== 'granted') return false

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'your-eas-project-id',  // from app.json extra.eas.projectId
    })
    const token = tokenData.data
    setExpoPushToken(token)

    // Android channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name:           'Default',
        importance:     Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor:     '#22c55e',
      })
    }

    // Register with Clutch API
    try {
      const authToken = await getToken()
      if (authToken) {
        await fetch(`${API_URL}/push/register`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body:    JSON.stringify({ token, platform: Platform.OS }),
        })
      }
    } catch (err) {
      console.error('[notifications] failed to register token:', err)
    }

    return true
  }

  return { expoPushToken, notification, permissionStatus, requestPermission }
}

// ── Schedule a local notification (for balance alerts, etc.) ──────────────────

export async function scheduleLocalNotification(
  title:   string,
  body:    string,
  data?:   Record<string, unknown>,
  seconds = 1,
): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: 'default' },
    trigger: seconds === 0 ? null : { seconds },
  })
}
