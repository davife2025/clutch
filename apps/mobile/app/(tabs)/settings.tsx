import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../src/lib/auth'

export default function SettingsScreen() {
  const { logout } = useAuth()
  function handleLogout() {
    Alert.alert('Sign out?', 'You will need to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ])
  }
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}><Text style={s.title}>Settings</Text></View>
      <ScrollView>
        <View style={s.section}>
          <Text style={s.sectionTitle}>Account</Text>
          <TouchableOpacity style={s.row} onPress={handleLogout}>
            <Text style={s.rowLabel}>Sign out</Text>
            <Text style={s.rowDanger}>›</Text>
          </TouchableOpacity>
        </View>
        <View style={s.section}>
          <Text style={s.sectionTitle}>About</Text>
          <View style={s.row}><Text style={s.rowLabel}>Version</Text><Text style={s.rowValue}>1.0.0</Text></View>
          <View style={s.row}><Text style={s.rowLabel}>Sessions built</Text><Text style={s.rowValue}>All 8</Text></View>
          <View style={s.row}><Text style={s.rowLabel}>AI Model</Text><Text style={s.rowValue}>Claude</Text></View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#09090b' },
  header:       { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title:        { fontSize: 24, fontWeight: '700', color: '#fff' },
  section:      { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 12, color: '#52525b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, fontWeight: '600' },
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#18181b', borderRadius: 12, padding: 14, marginBottom: 6 },
  rowLabel:     { color: '#fff', fontSize: 14 },
  rowValue:     { color: '#52525b', fontSize: 14 },
  rowDanger:    { color: '#ef4444', fontSize: 18 },
})
