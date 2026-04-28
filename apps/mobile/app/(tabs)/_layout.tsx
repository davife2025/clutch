import { Tabs } from 'expo-router'
import { View, StyleSheet } from 'react-native'

function TabIcon({ focused, emoji }: { focused: boolean; emoji: string }) {
  return (
    <View style={[s.icon, focused && s.iconActive]}>
      <View><View /></View>
    </View>
  )
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: s.tabBar,
      tabBarActiveTintColor: '#22c55e',
      tabBarInactiveTintColor: '#52525b',
      tabBarLabelStyle: s.label,
    }}>
      <Tabs.Screen name="index"    options={{ title: 'Dashboard', tabBarIcon: ({ color }) => <TabIconEmoji emoji="🫙" color={color} /> }} />
      <Tabs.Screen name="wallets"  options={{ title: 'Wallets',   tabBarIcon: ({ color }) => <TabIconEmoji emoji="👜" color={color} /> }} />
      <Tabs.Screen name="agent"    options={{ title: 'AI Agent',  tabBarIcon: ({ color }) => <TabIconEmoji emoji="✦"  color={color} /> }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity',  tabBarIcon: ({ color }) => <TabIconEmoji emoji="↕"  color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings',  tabBarIcon: ({ color }) => <TabIconEmoji emoji="⚙"  color={color} /> }} />
    </Tabs>
  )
}

function TabIconEmoji({ emoji, color }: { emoji: string; color: string }) {
  const { Text } = require('react-native')
  return <Text style={{ fontSize: 20, opacity: color === '#22c55e' ? 1 : 0.5 }}>{emoji}</Text>
}

const s = StyleSheet.create({
  tabBar:     { backgroundColor: '#09090b', borderTopColor: '#27272a', borderTopWidth: 1, paddingTop: 4 },
  label:      { fontSize: 11, marginBottom: 2 },
  icon:       { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  iconActive: { backgroundColor: '#22c55e15' },
})
