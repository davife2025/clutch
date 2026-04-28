/**
 * Supabase client for Expo / React Native.
 *
 * Uses AsyncStorage for session persistence instead of localStorage.
 * Install: expo install @react-native-async-storage/async-storage
 */

import { createClient } from '@supabase/supabase-js'
import AsyncStorage    from '@react-native-async-storage/async-storage'

const SUPABASE_URL      = process.env.EXPO_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage:            AsyncStorage,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: false,   // not a browser
  },
})
