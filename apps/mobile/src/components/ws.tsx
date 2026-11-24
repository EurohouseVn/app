// Bộ giao diện dùng chung theo mẫu màn Công trình và Quản lý xưởng:
// nền xám nhạt, thẻ trắng viền 1px không bóng, chữ đậm vừa, nút cam chữ trắng.
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors } from '@eurohouse/ui';
import { Icon, type IconName } from './Icon';

export const ws = {
  bg: '#F6F7F9',
  surface: '#FFFFFF',
  line: '#E4E7EC',
  lineSoft: '#EEF0F3',
  field: '#D0D5DD',
  ink: '#0A0A0A',
  text: '#1D2939',
  body: '#344054',
  muted: '#667085',
  faint: '#98A2B3',
  orange: colors.brandOrange,
  orangeText: colors.brandOrangeText,
  orangeSoft: '#FFF2E8',
  orangeLine: '#FED7AA',
  success: '#059669',
  successBg: '#ECFDF3',
  danger: '#DC2626',
  dangerText: '#B42318',
  dangerBg: '#FEF3F2',
  warning: '#B54708',
  warningBg: '#FFFAEB',
  info: '#1D4ED8',
  infoBg: '#EFF4FF',
} as const;

/** Đầu trang trắng cho màn phụ (giống Quản lý xưởng). */
export function SubHeader({ title, subtitle, onBack, right, children }: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <View style={s.header}>
      <View style={s.headerRow}>
        {onBack ? <IconButton icon="arrow-left" label="Quay lại" onPress={onBack} /> : null}
        <View style={s.grow}>
          <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={s.headerSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

export function IconButton({ icon, label, onPress, tone = 'plain', disabled }: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  tone?: 'plain' | 'orange' | 'danger';
  disabled?: boolean;
}) {
  const color = tone === 'orange' ? ws.orangeText : tone === 'danger' ? ws.dangerText : ws.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.iconButton, tone === 'orange' && s.iconButtonOrange, tone === 'danger' && s.iconButtonDanger, (pressed || disabled) && s.dim]}
    >
      <Icon name={icon} size={18} color={color} />
    </Pressable>
  );
}

/** Thanh tab dạng ô xám (Hôm nay / Việc khoán / ...). */
export function Segmented<T extends string>({ items, value, onChange }: { items: Array<[T, string]>; value: T; onChange: (value: T) => void }) {
  return (
    <View style={s.segmented}>
      {items.map(([key, label]) => (
        <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: value === key }} style={[s.segment, value === key && s.segmentOn]} onPress={() => onChange(key)}>
          <Text style={[s.segmentText, value === key && s.segmentTextOn]} numberOfLines={1}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  return <View style={[s.card, padded && s.cardPadded, style]}>{children}</View>;
}

/** Dòng trong thẻ danh sách, có đường kẻ phía trên trừ dòng đầu. */
export function ListRow({ children, first, onPress, style, label }: { children: ReactNode; first?: boolean; onPress?: () => void; style?: StyleProp<ViewStyle>; label?: string }) {
  if (!onPress) return <View style={[s.listRow, !first && s.listRowDivider, style]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [s.listRow, !first && s.listRowDivider, pressed && s.listRowPressed, style]}>
      {children}
    </Pressable>
  );
}

export function SectionHead({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <View style={s.sectionHead}>
      <View style={s.grow}>
        <Text style={s.sectionTitle}>{title}</Text>
        {sub ? <Text style={s.sectionSub}>{sub}</Text> : null}
      </View>
      {action}
    </View>
  );
}

/** Nhãn nhỏ in hoa có gạch cam phía trước (giống website nhomeurohouse.com). */
export function Kicker({ text, light }: { text: string; light?: boolean }) {
  return (
    <View style={s.kickerRow}>
      <View style={[s.kickerDash, light && s.kickerDashLight]} />
      <Text style={[s.kicker, light && s.kickerLight]} numberOfLines={1}>{text.toUpperCase()}</Text>
    </View>
  );
}

/** Tiêu đề thương hiệu: in hoa, đậm, leading ≥ 1.1 cho tiếng Việt có dấu. */
export function DisplayTitle({ text, size = 18, light, lines }: { text: string; size?: number; light?: boolean; lines?: number }) {
  return <Text style={[s.display, { fontSize: size, lineHeight: Math.round(size * 1.18) }, light && { color: '#FFFFFF' }]} numberOfLines={lines}>{text.toUpperCase()}</Text>;
}

/** Đầu mục kiểu thương hiệu: nhãn + tiêu đề + liên kết bên phải. */
export function BrandSectionHead({ kicker, title, action }: { kicker: string; title?: string; action?: ReactNode }) {
  return (
    <View style={s.brandHead}>
      <View style={s.grow}>
        <Kicker text={kicker} />
        {title ? <View style={{ marginTop: 4 }}><DisplayTitle text={title} size={17} /></View> : null}
      </View>
      {action}
    </View>
  );
}

export function KpiRow({ children }: { children: ReactNode }) {
  return <View style={s.kpiRow}>{children}</View>;
}

export function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'warning' | 'success' | 'danger' }) {
  return (
    <View style={s.kpi}>
      <Text style={s.kpiLabel} numberOfLines={1}>{label}</Text>
      <Text
        style={[s.kpiValue, tone === 'warning' && { color: ws.warning }, tone === 'success' && { color: ws.success }, tone === 'danger' && { color: ws.dangerText }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

export function Chip({ label, active, onPress, count, leading }: { label: string; active?: boolean; onPress?: () => void; count?: number; leading?: ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: Boolean(active) }} onPress={onPress} style={[s.chip, active && s.chipOn]}>
      {leading}
      <Text style={[s.chipText, active && s.chipTextOn]} numberOfLines={1}>{label}</Text>
      {count !== undefined ? <Text style={[s.chipCount, active && s.chipCountOn]}>{count}</Text> : null}
    </Pressable>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'danger';

export function Button({ label, icon, onPress, variant = 'primary', disabled, loading, style }: {
  label: string;
  icon?: IconName;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const color = variant === 'primary' ? colors.white : variant === 'soft' ? ws.orangeText : variant === 'danger' ? ws.dangerText : ws.text;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [s.button, s[`button_${variant}`], (disabled || loading) && s.dim, pressed && s.pressed, style]}
    >
      {loading ? <ActivityIndicator color={color} /> : icon ? <Icon name={icon} size={17} color={color} /> : null}
      <Text style={[s.buttonText, { color }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}

export function Input(props: TextInputProps & { invalid?: boolean }) {
  const { style, invalid, ...rest } = props;
  return <TextInput placeholderTextColor={ws.faint} {...rest} style={[s.input, rest.multiline && s.inputMultiline, invalid && s.inputInvalid, style]} />;
}

export function Field({ label, children, style }: { label: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.field, style]}>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </View>
  );
}

/** Ô chọn dạng nút: hiện giá trị, bấm để mở danh sách. */
export function SelectBox({ value, placeholder, onPress, label }: { value?: string; placeholder: string; onPress: () => void; label?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label ?? placeholder} onPress={onPress} style={({ pressed }) => [s.input, s.select, pressed && s.listRowPressed]}>
      <Text style={[s.selectText, !value && { color: ws.faint }]} numberOfLines={1}>{value || placeholder}</Text>
      <Icon name="chevron-down" size={16} color={ws.muted} />
    </Pressable>
  );
}

export function SearchBox({ value, onChangeText, placeholder }: { value: string; onChangeText: (value: string) => void; placeholder: string }) {
  return (
    <View style={s.search}>
      <Icon name="search" size={17} color={ws.muted} />
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={ws.faint} style={s.searchInput} returnKeyType="search" />
      {value ? <Pressable accessibilityLabel="Xoá tìm kiếm" onPress={() => onChangeText('')} style={s.searchClear}><Icon name="x" size={15} color={ws.muted} /></Pressable> : null}
    </View>
  );
}

export function Banner({ text, title, tone = 'info', icon, onPress }: { text: string; title?: string; tone?: 'info' | 'warning' | 'error' | 'success' | 'orange'; icon?: IconName; onPress?: () => void }) {
  const palette = {
    info: { bg: ws.infoBg, line: '#C7D7FE', fg: ws.info, icon: 'info' as IconName },
    warning: { bg: ws.warningBg, line: '#FEDF89', fg: ws.warning, icon: 'alert-circle' as IconName },
    error: { bg: ws.dangerBg, line: '#FECDCA', fg: ws.dangerText, icon: 'alert-circle' as IconName },
    success: { bg: ws.successBg, line: '#A6F4C5', fg: ws.success, icon: 'check-circle' as IconName },
    orange: { bg: '#FFF7EF', line: ws.orangeLine, fg: '#9A4B15', icon: 'sliders' as IconName },
  }[tone];
  const body = (
    <>
      <Icon name={icon ?? palette.icon} size={16} color={palette.fg} />
      <View style={s.grow}>
        {title ? <Text style={[s.bannerTitle, { color: palette.fg }]}>{title}</Text> : null}
        <Text style={[s.bannerText, { color: palette.fg }]}>{text}</Text>
      </View>
    </>
  );
  return onPress
    ? <Pressable onPress={onPress} style={[s.banner, { backgroundColor: palette.bg, borderColor: palette.line }]}>{body}</Pressable>
    : <View style={[s.banner, { backgroundColor: palette.bg, borderColor: palette.line }]}>{body}</View>;
}

export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <View style={s.empty}>
      <Icon name={icon} size={28} color={ws.faint} />
      <Text style={s.emptyTitle}>{title}</Text>
      {text ? <Text style={s.emptyText}>{text}</Text> : null}
      {action ? <View style={{ marginTop: 12 }}>{action}</View> : null}
    </View>
  );
}

export function Loading({ text = 'Đang tải...' }: { text?: string }) {
  return <View style={s.loading}><ActivityIndicator color={ws.orange} /><Text style={s.loadingText}>{text}</Text></View>;
}

/** Ô +/− số lượng. */
export function QtyStepper({ value, onChange, min = 0 }: { value: number; onChange: (value: number) => void; min?: number }) {
  return (
    <View style={s.stepper}>
      <Pressable accessibilityLabel="Giảm" disabled={value <= min} onPress={() => onChange(Math.max(min, value - 1))} style={[s.stepperButton, value <= min && s.dim]}>
        <Icon name="minus" size={14} color={ws.text} />
      </Pressable>
      <Text style={[s.stepperValue, value > 0 && { color: ws.ink }]}>{value}</Text>
      <Pressable accessibilityLabel="Tăng" onPress={() => onChange(value + 1)} style={[s.stepperButton, s.stepperAdd]}>
        <Icon name="plus" size={14} color={colors.white} />
      </Pressable>
    </View>
  );
}

/** Bảng trượt từ dưới lên. */
export function Sheet({ visible, onClose, title, sub, children, tall, scroll = true, onShow }: {
  visible: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  children: ReactNode;
  tall?: boolean;
  scroll?: boolean;
  onShow?: () => void;
}) {
  // Khung nhìn của danh sách phải có chiều cao tối đa cụ thể, nếu không Android để nội dung tràn khỏi bảng
  // mà không cuộn được. Chừa chỗ cho tiêu đề, tay nắm và lề dưới của bảng.
  const { height: windowHeight } = useWindowDimensions();
  const bodyMax = Math.max(160, Math.round(windowHeight * 0.86) - 110);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onShow={onShow}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Đóng" onPress={onClose} />
        <View style={[s.sheet, tall && s.sheetTall]}>
          <View style={s.sheetHandle} />
          <View style={s.sheetHeader}>
            <View style={s.grow}>
              <Text style={s.sheetTitle}>{title}</Text>
              {sub ? <Text style={s.sheetSub}>{sub}</Text> : null}
            </View>
            <IconButton icon="x" label="Đóng" onPress={onClose} />
          </View>
          {scroll ? <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={tall ? { flex: 1 } : { flexGrow: 0, maxHeight: bodyMax }} contentContainerStyle={s.sheetBody}>{children}</ScrollView> : <View style={[s.sheetBody, { flex: 1 }]}>{children}</View>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Danh sách chọn một giá trị trong bảng trượt. */
export function OptionSheet({ visible, title, options, value, onSelect, onClose }: {
  visible: boolean;
  title: string;
  options: string[];
  value?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {options.map((option, index) => (
        <Pressable key={option} accessibilityRole="button" onPress={() => onSelect(option)} style={({ pressed }) => [s.option, index > 0 && s.listRowDivider, pressed && s.listRowPressed]}>
          <Text style={[s.optionText, value === option && s.optionTextOn]}>{option}</Text>
          {value === option ? <Icon name="check" size={17} color={ws.orange} /> : null}
        </Pressable>
      ))}
    </Sheet>
  );
}

/** Dòng nhãn – giá trị (tổng tiền, khối lượng...). */
export function ValueLine({ label, value, detail, strong, tone, first }: { label: string; value: string; detail?: string; strong?: boolean; tone?: 'minus' | 'orange' | 'success'; first?: boolean }) {
  return (
    <View style={[s.valueLine, !first && s.listRowDivider, strong && s.valueLineStrong]}>
      <View style={s.grow}>
        <Text style={[s.valueLabel, strong && s.valueLabelStrong]}>{label}</Text>
        {detail ? <Text style={s.valueDetail}>{detail}</Text> : null}
      </View>
      <Text style={[s.valueText, strong && s.valueLabelStrong, tone === 'minus' && { color: ws.danger }, tone === 'orange' && { color: ws.orangeText }, tone === 'success' && { color: ws.success }]}>{value}</Text>
    </View>
  );
}

export const wsStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ws.bg },
  content: { padding: 14, paddingBottom: 140 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1, minWidth: 0 },
  grow: { flex: 1, minWidth: 0 },
  avatar: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: ws.orangeSoft },
  rowTitle: { color: ws.ink, fontSize: 14, lineHeight: 19, fontWeight: '800' },
  rowMeta: { color: ws.muted, fontSize: 11.5, marginTop: 2 },
  rowValue: { color: ws.ink, fontSize: 14, fontWeight: '900' },
  hint: { color: ws.muted, fontSize: 11.5, lineHeight: 16, marginTop: 8 },
  gap: { height: 10 },
});

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  dim: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
  header: { paddingTop: Platform.OS === 'ios' ? 48 : 28, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: ws.surface, borderBottomWidth: 1, borderBottomColor: ws.line },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { color: ws.ink, fontSize: 19, lineHeight: 24, fontWeight: '900' },
  headerSubtitle: { color: ws.muted, fontSize: 12, marginTop: 2 },
  iconButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  iconButtonOrange: { backgroundColor: ws.orangeSoft },
  iconButtonDanger: { backgroundColor: ws.dangerBg },
  segmented: { flexDirection: 'row', gap: 4, marginTop: 12, padding: 4, backgroundColor: '#F2F4F7', borderRadius: 12 },
  segment: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9, paddingHorizontal: 4 },
  segmentOn: { backgroundColor: ws.surface, shadowColor: '#101828', shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentText: { color: ws.muted, fontSize: 12.5, fontWeight: '700' },
  segmentTextOn: { color: ws.ink, fontWeight: '800' },
  card: { backgroundColor: ws.surface, borderRadius: 14, borderWidth: 1, borderColor: ws.line, overflow: 'hidden' },
  cardPadded: { padding: 14 },
  listRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: ws.surface },
  listRowDivider: { borderTopWidth: 1, borderTopColor: ws.lineSoft },
  listRowPressed: { backgroundColor: '#F9FAFB' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, marginBottom: 8 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kickerDash: { width: 18, height: 2, backgroundColor: ws.orange },
  kickerDashLight: { backgroundColor: '#FFB46B' },
  kicker: { color: '#C65309', fontSize: 10.5, lineHeight: 14, fontWeight: '800', letterSpacing: 1.4 },
  kickerLight: { color: '#FFD09C' },
  display: { color: '#151A22', fontWeight: '900', letterSpacing: -0.2 },
  brandHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 22, marginBottom: 10 },
  sectionTitle: { color: ws.ink, fontSize: 15, fontWeight: '900' },
  sectionSub: { color: ws.muted, fontSize: 11.5, marginTop: 2 },
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, minWidth: 0, backgroundColor: ws.surface, borderRadius: 12, borderWidth: 1, borderColor: ws.line, paddingHorizontal: 10, paddingVertical: 9 },
  kpiLabel: { color: ws.muted, fontSize: 10.5, fontWeight: '700' },
  kpiValue: { color: '#101828', fontSize: 16, fontWeight: '900', marginTop: 2 },
  chip: { minHeight: 34, maxWidth: 260, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: ws.line, backgroundColor: ws.surface },
  chipOn: { borderColor: ws.orange, backgroundColor: ws.orangeSoft },
  chipText: { color: ws.text, fontSize: 12.5, fontWeight: '700' },
  chipTextOn: { color: ws.orangeText, fontWeight: '800' },
  chipCount: { color: ws.muted, fontSize: 12, fontWeight: '700' },
  chipCountOn: { color: ws.orangeText },
  button: { minHeight: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14 },
  button_primary: { backgroundColor: ws.orange },
  button_secondary: { backgroundColor: ws.surface, borderWidth: 1, borderColor: ws.field },
  button_soft: { backgroundColor: ws.orangeSoft, borderWidth: 1, borderColor: ws.orangeLine },
  button_danger: { backgroundColor: ws.dangerBg, borderWidth: 1, borderColor: '#FECDCA' },
  buttonText: { fontSize: 14, fontWeight: '800' },
  label: { color: ws.body, fontSize: 12, fontWeight: '800', marginBottom: 6 },
  field: { marginTop: 12 },
  input: { minHeight: 46, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: ws.field, color: ws.ink, backgroundColor: ws.surface, fontSize: 14 },
  inputMultiline: { minHeight: 86, paddingTop: 11, textAlignVertical: 'top' },
  inputInvalid: { borderColor: ws.danger },
  select: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectText: { flex: 1, color: ws.ink, fontSize: 14 },
  search: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: ws.surface, borderWidth: 1, borderColor: ws.line },
  searchInput: { flex: 1, minWidth: 0, color: '#101828', fontSize: 14, paddingVertical: 0 },
  searchClear: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 11, borderRadius: 12, borderWidth: 1 },
  bannerTitle: { fontSize: 13, fontWeight: '900', marginBottom: 1 },
  bannerText: { fontSize: 12, lineHeight: 17, fontWeight: '600' },
  empty: { minHeight: 170, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: ws.field, alignItems: 'center', justifyContent: 'center', padding: 22 },
  emptyTitle: { color: ws.body, fontSize: 14, fontWeight: '800', marginTop: 10, textAlign: 'center' },
  emptyText: { color: ws.muted, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 5 },
  loading: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: ws.muted, fontSize: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: ws.line, borderRadius: 10, overflow: 'hidden', backgroundColor: ws.surface },
  stepperButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  stepperAdd: { backgroundColor: ws.orange },
  stepperValue: { minWidth: 30, textAlign: 'center', color: ws.muted, fontSize: 14, fontWeight: '900' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,24,40,0.45)' },
  sheet: { maxHeight: '86%', backgroundColor: ws.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 18 },
  sheetTall: { height: '86%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: ws.field, alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  sheetTitle: { color: ws.ink, fontSize: 16, fontWeight: '900' },
  sheetSub: { color: ws.muted, fontSize: 12, marginTop: 2 },
  sheetBody: { paddingHorizontal: 16, paddingBottom: 10 },
  option: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  optionText: { flex: 1, color: ws.text, fontSize: 14, fontWeight: '600' },
  optionTextOn: { color: ws.orangeText, fontWeight: '800' },
  valueLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 9, paddingHorizontal: 12 },
  valueLineStrong: { backgroundColor: '#F9FAFB' },
  valueLabel: { color: ws.text, fontSize: 13 },
  valueLabelStrong: { color: ws.ink, fontWeight: '900' },
  valueDetail: { color: ws.muted, fontSize: 11, marginTop: 1 },
  valueText: { color: ws.ink, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
