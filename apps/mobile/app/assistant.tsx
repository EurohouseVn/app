import { useCallback, useEffect, useRef, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../src/components/Icon';
import { api } from '../src/lib/api';
import { Banner, Button, Card, Field, Input, Segmented, SubHeader, ws, wsStyles } from '../src/components/ws';
import avatar from '../assets/brand/assistant-avatar.png';

type Tab = 'chat' | 'setup';
type AiStatus = { assistantName?: string; configured: boolean; enabled: boolean };
type Turn = { id: string; role: 'USER' | 'ASSISTANT'; content: string };

const DEFAULT_NAME = 'Bé Eu';
const ERRORS: Record<string, string> = {
  AI_UNAVAILABLE: 'Bé Eu đang tạm nghỉ. Câu hỏi của bạn đã được lưu, hãy thử lại sau ít phút.',
  AI_BUSY: 'Bé Eu đang có nhiều người hỏi, vui lòng thử lại sau.',
};

function friendly(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : '';
  return ERRORS[message] ?? (message || fallback);
}

/** Dòng "đang soạn tin" với ba chấm nhảy bằng chữ, thay cho biểu tượng quay. */
function TypingText({ name }: { name: string }) {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const timer = setInterval(() => setDots((value) => (value % 3) + 1), 450);
    return () => clearInterval(timer);
  }, []);
  return <Text style={styles.typing}>{name} đang soạn tin{'.'.repeat(dots)}</Text>;
}

export default function AssistantScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('chat');
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const name = status?.assistantName ?? DEFAULT_NAME;

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await api.get<AiStatus>('/ai/status'));
      setStatusError('');
    } catch (error) {
      setStatusError(friendly(error, 'Không tải được trạng thái trợ lý.'));
    }
  }, []);
  useEffect(() => { void loadStatus(); }, [loadStatus]);

  return (
    <KeyboardAvoidingView style={wsStyles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: false }} />
      <SubHeader title={name} subtitle="Trợ lý riêng của xưởng bạn" onBack={() => router.back()} right={<Image source={avatar} style={styles.headerAvatar} accessibilityLabel={name} />}>
        <View style={{ marginTop: 10 }}>
          <Segmented<Tab> items={[['chat', 'Trò chuyện'], ['setup', 'Xưởng']]} value={tab} onChange={setTab} />
        </View>
      </SubHeader>
      {statusError ? <View style={styles.pad}><Banner tone="error" text={statusError} /></View> : null}
      {status && !status.configured ? <View style={styles.pad}><Banner tone="warning" text="Bé Eu chưa được bật trên hệ thống. Vui lòng liên hệ quản trị." /></View> : null}
      {status && status.configured && !status.enabled ? <View style={styles.pad}><Banner tone="warning" text="Bé Eu của xưởng đang tắt. Bật lại ở tab Xưởng." /></View> : null}
      {tab === 'chat' ? <ChatTab name={name} disabled={!status?.configured || !status?.enabled} /> : null}
      {tab === 'setup' ? <SetupTab onSaved={loadStatus} /> : null}
    </KeyboardAvoidingView>
  );
}

function ChatTab({ disabled, name }: { disabled: boolean; name: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scroller = useRef<ScrollView>(null);

  async function send() {
    const message = text.trim();
    if (!message || sending) return;
    setError('');
    setSending(true);
    setTurns((current) => [...current, { id: `local-${Date.now()}`, role: 'USER', content: message }]);
    setText('');
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 50);
    try {
      const result = await api.post<{ conversationId: string; messageId: string; reply: string }>('/ai/chat', { conversationId, message }, { timeoutMs: 120_000 });
      setConversationId(result.conversationId);
      setTurns((current) => [...current, { id: result.messageId, role: 'ASSISTANT', content: result.reply }]);
    } catch (sendError) {
      setError(friendly(sendError, 'Không gửi được câu hỏi.'));
      setText(message);
      setTurns((current) => current.slice(0, -1));
    } finally {
      setSending(false);
      setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={styles.chatContent} keyboardShouldPersistTaps="handled">
        {turns.length === 0 ? (
          <View style={styles.hello}>
            <Image source={avatar} style={styles.helloAvatar} accessibilityLabel={name} />
            <Text style={styles.helloTitle}>Chào bạn, mình là {name}!</Text>
            <Text style={styles.helloText}>Hỏi mình về nhôm kính, hệ nhôm Eurohouse, báo giá, công trình. Mình chỉ phục vụ riêng xưởng của bạn và nhớ nội dung cuộc trò chuyện này.</Text>
          </View>
        ) : turns.map((turn) => (
          <View key={turn.id} style={turn.role === 'USER' ? styles.rowUser : styles.rowBot}>
            {turn.role === 'ASSISTANT' ? <Image source={avatar} style={styles.botAvatar} accessibilityLabel={name} /> : null}
            <View style={[styles.bubble, turn.role === 'USER' ? styles.bubbleUser : styles.bubbleBot]}>
              <Text style={[styles.bubbleText, turn.role === 'USER' && { color: '#FFFFFF' }]} selectable>{turn.content}</Text>
            </View>
          </View>
        ))}
        {sending ? <View style={styles.rowBot}><Image source={avatar} style={styles.botAvatar} /><View style={[styles.bubble, styles.bubbleBot]}><TypingText name={name} /></View></View> : null}
        {error ? <Banner tone="error" text={error} /> : null}
      </ScrollView>
      <View style={styles.composer}>
        <View style={{ flex: 1 }}>
          <Input value={text} onChangeText={setText} placeholder="Nhập câu hỏi…" multiline editable={!disabled} style={{ minHeight: 46, maxHeight: 120 }} />
        </View>
        <Pressable accessibilityLabel="Gửi" disabled={disabled || sending || !text.trim()} onPress={send} style={[styles.sendButton, (disabled || sending || !text.trim()) && { opacity: 0.45 }]}>
          <Icon name="send" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

function SetupTab({ onSaved }: { onSaved: () => Promise<void> }) {
  const [instructions, setInstructions] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ enabled: boolean; systemInstructions: string }>('/ai/profile')
      .then((profile) => { setInstructions(profile.systemInstructions); setEnabled(profile.enabled); setLoaded(true); })
      .catch((loadError) => setError(friendly(loadError, 'Không tải được cài đặt.')));
  }, []);

  async function save() {
    setSaving(true);
    setError('');
    try {
      await api.put('/ai/profile', { systemInstructions: instructions, enabled });
      await onSaved();
      Alert.alert('Đã lưu', 'Bé Eu sẽ dùng quy tắc mới từ cuộc trò chuyện tiếp theo.');
    } catch (saveError) {
      setError(friendly(saveError, 'Không lưu được.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={wsStyles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={wsStyles.rowTitle}>Quy tắc riêng của xưởng</Text>
        <Text style={wsStyles.hint}>Bé Eu luôn làm theo nội dung này khi trả lời người dùng của xưởng bạn: tên xưởng, sản phẩm chính, cách xưng hô, điều không được nói (ví dụ không báo giá cố định).</Text>
        <Field label="Nội dung" style={{ marginTop: 10 }}>
          <Input value={instructions} onChangeText={setInstructions} multiline placeholder="Ví dụ: Xưởng chuyên cửa nhôm Xingfa. Gọi khách là anh/chị. Giá chỉ mang tính tham khảo." editable={loaded} style={{ minHeight: 140 }} />
        </Field>
        <Pressable onPress={() => setEnabled((value) => !value)} style={styles.toggleRow} accessibilityRole="switch" accessibilityState={{ checked: enabled }}>
          <View style={[styles.toggleBox, enabled && styles.toggleBoxOn]}>{enabled ? <Icon name="check" size={14} color="#FFFFFF" /> : null}</View>
          <Text style={wsStyles.rowTitle}>Bật Bé Eu cho xưởng</Text>
        </Pressable>
        {error ? <View style={{ marginTop: 10 }}><Banner tone="error" text={error} /></View> : null}
        <Button label="Lưu" icon="save" onPress={save} loading={saving} disabled={!loaded} style={{ marginTop: 12 }} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 14, paddingTop: 10 },
  headerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: ws.orangeSoft },
  chatContent: { padding: 14, paddingBottom: 20, gap: 10 },
  hello: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 18 },
  helloAvatar: { width: 132, height: 132 },
  helloTitle: { color: ws.ink, fontSize: 18, fontWeight: '900', marginTop: 8 },
  helloText: { color: ws.muted, fontSize: 13.5, lineHeight: 20, textAlign: 'center', marginTop: 6, maxWidth: 320 },
  rowUser: { alignSelf: 'flex-end', maxWidth: '86%' },
  rowBot: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'flex-end', gap: 6, maxWidth: '92%' },
  botAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: ws.orangeSoft },
  bubble: { borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10, flexShrink: 1 },
  bubbleUser: { backgroundColor: ws.orange },
  bubbleBot: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: ws.line },
  bubbleText: { color: ws.text, fontSize: 14.5, lineHeight: 21 },
  typing: { color: ws.muted, fontSize: 13.5, fontStyle: 'italic' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, paddingBottom: 14, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: ws.line },
  sendButton: { width: 46, height: 46, borderRadius: 12, backgroundColor: ws.orange, alignItems: 'center', justifyContent: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  toggleBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: ws.field, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  toggleBoxOn: { backgroundColor: ws.orange, borderColor: ws.orange },
});
