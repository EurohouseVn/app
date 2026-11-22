import { useCallback, useEffect, useRef, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../src/components/Icon';
import { api } from '../src/lib/api';
import { Banner, Button, Card, EmptyState, Field, Input, Segmented, SubHeader, ws, wsStyles } from '../src/components/ws';
import avatar from '../assets/brand/assistant-avatar.png';

const DEFAULT_NAME = 'Bé Eu';

type Tab = 'chat' | 'image' | 'setup';
type Quota = { limit: number; used: number; remaining: number; resetsAt: string | null };
type AiStatus = { assistantName?: string; configured: boolean; enabled: boolean; imageQuota: Quota };
type Turn = { id: string; role: 'USER' | 'ASSISTANT'; content: string };
type ImageItem = { id: string; prompt: string; createdAt: string };

const ERRORS: Record<string, string> = {
  AI_UNAVAILABLE: 'Trợ lý AI đang tạm nghỉ. Câu hỏi của bạn đã được lưu, hãy thử lại sau ít phút.',
  AI_BUSY: 'Trợ lý đang có nhiều người dùng, vui lòng thử lại sau.',
  IMAGE_LIMIT_REACHED: 'Bạn đã dùng hết 10 ảnh của tuần này.',
  IMAGE_FAILED: 'Chưa tạo được ảnh, lượt này không bị tính. Hãy mô tả lại rõ hơn.',
};

function friendly(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : '';
  return ERRORS[message] ?? (message || fallback);
}

function resetText(quota: Quota | undefined) {
  if (!quota?.resetsAt) return '';
  const date = new Date(quota.resetsAt);
  return `Có thêm ảnh từ ${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')} lúc ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}.`;
}

function GeneratedImage({ id }: { id: string }) {
  const [uri, setUri] = useState('');
  useEffect(() => {
    let alive = true;
    api.get<{ mime: string; base64: string }>(`/ai/images/${id}/data`)
      .then((data) => { if (alive) setUri(`data:${data.mime};base64,${data.base64}`); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [id]);
  return uri ? <Image source={{ uri }} style={styles.image} resizeMode="contain" /> : <View style={[styles.image, styles.imageLoading]}><ActivityIndicator color={ws.orange} /></View>;
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
          <Segmented<Tab> items={[['chat', 'Trò chuyện'], ['image', 'Tạo ảnh'], ['setup', 'Xưởng']]} value={tab} onChange={setTab} />
        </View>
      </SubHeader>
      {statusError ? <View style={styles.pad}><Banner tone="error" text={statusError} /></View> : null}
      {status && !status.configured ? <View style={styles.pad}><Banner tone="warning" text="Trợ lý AI chưa được bật trên hệ thống. Vui lòng liên hệ quản trị." /></View> : null}
      {status && status.configured && !status.enabled ? <View style={styles.pad}><Banner tone="warning" text="Trợ lý AI của xưởng đang tắt. Bật lại ở tab Xưởng." /></View> : null}
      {tab === 'chat' ? <ChatTab name={name} disabled={!status?.configured || !status?.enabled} /> : null}
      {tab === 'image' ? <ImageTab quota={status?.imageQuota} disabled={!status?.configured || !status?.enabled} onChanged={loadStatus} /> : null}
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
            <Text style={styles.helloText}>Hỏi mình về nhôm kính, báo giá, công trình. Mình chỉ phục vụ riêng xưởng của bạn và nhớ nội dung cuộc trò chuyện này.</Text>
          </View>
        ) : turns.map((turn) => (
          <View key={turn.id} style={turn.role === 'USER' ? styles.rowUser : styles.rowBot}>
            {turn.role === 'ASSISTANT' ? <Image source={avatar} style={styles.botAvatar} accessibilityLabel={name} /> : null}
            <View style={[styles.bubble, turn.role === 'USER' ? styles.bubbleUser : styles.bubbleBot]}>
              <Text style={[styles.bubbleText, turn.role === 'USER' && { color: '#FFFFFF' }]} selectable>{turn.content}</Text>
            </View>
          </View>
        ))}
        {sending ? <View style={styles.rowBot}><Image source={avatar} style={styles.botAvatar} /><View style={[styles.bubble, styles.bubbleBot]}><ActivityIndicator color={ws.orange} /></View></View> : null}
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

function ImageTab({ quota, disabled, onChanged }: { quota?: Quota; disabled: boolean; onChanged: () => Promise<void> }) {
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<ImageItem[]>([]);

  const load = useCallback(async () => {
    try { setItems(await api.get<ImageItem[]>('/ai/images')); } catch { /* giữ danh sách cũ */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create() {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/ai/images', { prompt: prompt.trim() }, { timeoutMs: 200_000 });
      setPrompt('');
      await Promise.all([load(), onChanged()]);
    } catch (createError) {
      setError(friendly(createError, 'Không tạo được ảnh.'));
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  const remaining = quota?.remaining ?? 0;
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={wsStyles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={wsStyles.rowTitle}>Còn {quota ? remaining : '…'}/{quota?.limit ?? 10} ảnh trong 7 ngày qua</Text>
        {quota && remaining === 0 ? <Text style={wsStyles.hint}>{resetText(quota)}</Text> : <Text style={wsStyles.hint}>Mỗi người được tạo tối đa {quota?.limit ?? 10} ảnh mỗi tuần.</Text>}
        <Field label="Mô tả ảnh" style={{ marginTop: 10 }}>
          <Input value={prompt} onChangeText={setPrompt} placeholder="Ví dụ: Cửa đi nhôm kính bốn cánh màu xám ghi, nền trắng" multiline editable={!disabled && remaining > 0} />
        </Field>
        <Button label={busy ? 'Đang tạo ảnh, vui lòng chờ…' : 'Tạo ảnh'} icon="image" onPress={create} loading={busy} disabled={disabled || remaining <= 0 || !prompt.trim()} style={{ marginTop: 10 }} />
        {error ? <View style={{ marginTop: 10 }}><Banner tone="error" text={error} /></View> : null}
      </Card>
      <View style={wsStyles.gap} />
      {items.length === 0 ? <EmptyState icon="image" title="Chưa có ảnh nào" text="Ảnh bạn tạo sẽ được lưu ở đây." /> : items.map((item) => (
        <Card key={item.id} style={{ marginBottom: 10 }}>
          <GeneratedImage id={item.id} />
          <Text style={[wsStyles.rowMeta, { marginTop: 8 }]} numberOfLines={3}>{item.prompt}</Text>
        </Card>
      ))}
    </ScrollView>
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
      Alert.alert('Đã lưu', 'Trợ lý sẽ dùng quy tắc mới từ cuộc trò chuyện tiếp theo.');
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
        <Text style={wsStyles.hint}>Trợ lý luôn làm theo nội dung này khi trả lời người dùng của xưởng bạn: tên xưởng, sản phẩm chính, cách xưng hô, điều không được nói (ví dụ không báo giá cố định).</Text>
        <Field label="Nội dung" style={{ marginTop: 10 }}>
          <Input value={instructions} onChangeText={setInstructions} multiline placeholder="Ví dụ: Xưởng chuyên cửa nhôm Xingfa. Gọi khách là anh/chị. Giá chỉ mang tính tham khảo." editable={loaded} style={{ minHeight: 140 }} />
        </Field>
        <Pressable onPress={() => setEnabled((value) => !value)} style={styles.toggleRow} accessibilityRole="switch" accessibilityState={{ checked: enabled }}>
          <View style={[styles.toggleBox, enabled && styles.toggleBoxOn]}>{enabled ? <Icon name="check" size={14} color="#FFFFFF" /> : null}</View>
          <Text style={wsStyles.rowTitle}>Bật trợ lý AI cho xưởng</Text>
        </Pressable>
        {error ? <View style={{ marginTop: 10 }}><Banner tone="error" text={error} /></View> : null}
        <Button label="Lưu" icon="save" onPress={save} loading={saving} disabled={!loaded} style={{ marginTop: 12 }} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 14, paddingTop: 10 },
  chatContent: { padding: 14, paddingBottom: 20, gap: 10 },
  headerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: ws.orangeSoft },
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
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, paddingBottom: 14, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: ws.line },
  sendButton: { width: 46, height: 46, borderRadius: 12, backgroundColor: ws.orange, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', aspectRatio: 3 / 2, borderRadius: 10, backgroundColor: '#F2F4F7' },
  imageLoading: { alignItems: 'center', justifyContent: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  toggleBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: ws.field, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  toggleBoxOn: { backgroundColor: ws.orange, borderColor: ws.orange },
});
