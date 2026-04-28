import { useState, useRef, useEffect, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { getToken } from '../../src/lib/api'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001'

interface Message { id: string; role: 'user' | 'assistant'; content: string }

export default function AgentChatScreen() {
  const { pocketId } = useLocalSearchParams<{ pocketId: string }>()
  const router = useRouter()
  const listRef = useRef<FlatList>(null)

  const [messages, setMessages] = useState<Message[]>([
    { id: '0', role: 'assistant', content: "Hi! I'm your Clutch AI agent. I can analyse your wallets, suggest optimisations, and execute payments across any chain. What would you like to do?" }
  ])
  const [input, setInput]       = useState('')
  const [streaming, setStreaming] = useState(false)

  async function sendMessage() {
    if (!input.trim() || streaming) return
    const text = input.trim()
    setInput('')
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    const userMsg: Message = { id: String(Date.now()), role: 'user', content: text }
    const assistantMsg: Message = { id: String(Date.now() + 1), role: 'assistant', content: '' }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setStreaming(true)

    try {
      const token = await getToken()
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))

      const res = await fetch(`${API_URL}/agent/chat/${pocketId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: history }),
      })

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) return

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value).split('\n').filter(Boolean)
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const chunk = line.slice(5).trim()
            if (chunk) {
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + chunk,
                }
                return updated
              })
            }
          }
        }
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch {
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: 'Error: Could not reach agent. Check ANTHROPIC_API_KEY.' }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Text style={s.backText}>✕</Text>
        </TouchableOpacity>
        <Text style={s.title}>AI Agent</Text>
        <Text style={s.model}>Claude</Text>
      </View>

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={s.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item: msg }) => (
            <View style={[s.bubble, msg.role === 'user' ? s.bubbleUser : s.bubbleBot]}>
              {msg.role === 'assistant' && (
                <View style={s.botIcon}><Text style={s.botIconText}>✦</Text></View>
              )}
              <View style={[s.bubbleInner, msg.role === 'user' ? s.bubbleInnerUser : s.bubbleInnerBot]}>
                <Text style={[s.bubbleText, msg.role === 'user' && s.bubbleTextUser]}>
                  {msg.content || (streaming && '…')}
                </Text>
              </View>
            </View>
          )}
        />
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            placeholder="Ask about wallets, request a payment..."
            placeholderTextColor="#52525b"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            editable={!streaming}
          />
          <TouchableOpacity style={[s.sendBtn, (!input.trim() || streaming) && s.sendBtnDisabled]}
            onPress={sendMessage} disabled={!input.trim() || streaming}>
            <Text style={s.sendText}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: '#09090b' },
  flex:            { flex: 1 },
  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#27272a' },
  back:            { paddingRight: 12 },
  backText:        { color: '#52525b', fontSize: 18 },
  title:           { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700' },
  model:           { fontSize: 12, color: '#22c55e', backgroundColor: '#052e16', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  list:            { padding: 16, gap: 12 },
  bubble:          { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubbleUser:      { justifyContent: 'flex-end' },
  bubbleBot:       { justifyContent: 'flex-start' },
  botIcon:         { width: 28, height: 28, borderRadius: 8, backgroundColor: '#052e16', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  botIconText:     { color: '#22c55e', fontSize: 12 },
  bubbleInner:     { maxWidth: '80%', borderRadius: 18, padding: 12 },
  bubbleInnerUser: { backgroundColor: '#27272a', borderBottomRightRadius: 4 },
  bubbleInnerBot:  { backgroundColor: '#18181b', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#27272a' },
  bubbleText:      { color: '#d4d4d8', fontSize: 15, lineHeight: 22 },
  bubbleTextUser:  { color: '#fff' },
  inputRow:        { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: '#27272a' },
  input:           { flex: 1, backgroundColor: '#18181b', borderWidth: 1, borderColor: '#3f3f46', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, color: '#fff', fontSize: 15, maxHeight: 100 },
  sendBtn:         { width: 40, height: 40, borderRadius: 12, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.3 },
  sendText:        { color: '#000', fontSize: 18, fontWeight: '700' },
})
