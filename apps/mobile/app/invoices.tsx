import { useCallback, useMemo, useState } from 'react';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { WorkshopSalesInvoice, WorkshopSalesInvoiceSummary, WorkshopTaxLedger } from '@eurohouse/types';
import { Icon, type IconName } from '../src/components/Icon';
import { InvoiceStatusPill } from '../src/components/InvoiceStatusPill';
import {
  Banner, Button, Card, Chip, EmptyState, IconButton, ListRow, Loading, SearchBox, SectionHead, Segmented, Sheet, SubHeader, ValueLine, ws, wsStyles,
} from '../src/components/ws';
import { api } from '../src/lib/api';
import { downloadAndShare, XLSX_MIME } from '../src/lib/fileDownload';
import {
  compactMoney, dmy, filterInvoices, groupInvoicesByMonth, ledgerBanner, money, statusCounts, statusMeta,
  type InvoiceFilter, type StatusTone,
} from '../src/lib/invoiceState';

type Tab = 'revenue' | 'invoices' | 'reports';
type ProjectOption = { id: string; name: string; code: string; status: string; customerName?: string };

const TABS: Array<[Tab, string]> = [['revenue', 'Doanh thu'], ['invoices', 'Hoá đơn'], ['reports', 'Báo cáo']];
const FILTERS: Array<[InvoiceFilter, string]> = [['ALL', 'Tất cả'], ['DRAFT', 'Nháp'], ['ISSUED', 'Đã phát hành'], ['CANCELLED', 'Đã huỷ']];
const QUARTER_MONTHS = ['Th 1–3', 'Th 4–6', 'Th 7–9', 'Th 10–12'];

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function todayLabel(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function InvoicesScreen() {
  const router = useRouter();
  const thisYear = new Date().getFullYear();
  const [tab, setTab] = useState<Tab>('revenue');
  const [year, setYear] = useState(thisYear);
  const [ledger, setLedger] = useState<WorkshopTaxLedger | null>(null);
  const [invoices, setInvoices] = useState<WorkshopSalesInvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<InvoiceFilter>('ALL');
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[] | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const [ledgerRow, invoiceRows] = await Promise.all([
        api.get<WorkshopTaxLedger>(`/workshop/tax/ledger?year=${year}`),
        api.get<WorkshopSalesInvoiceSummary[]>(`/workshop/tax/invoices?year=${year}`),
      ]);
      setLedger(ledgerRow);
      setInvoices(invoiceRows);
    } catch (loadError) {
      setError(errorText(loadError, 'Không tải được sổ doanh thu.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [year]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const filtered = useMemo(() => filterInvoices(invoices, filter, query), [invoices, filter, query]);
  const groups = useMemo(() => groupInvoicesByMonth(filtered), [filtered]);
  const counts = useMemo(() => statusCounts(invoices), [invoices]);
  const banner = ledger ? ledgerBanner(ledger) : null;

  async function openCreate() {
    setCreateOpen(true);
    if (projects) return;
    try {
      const rows = await api.get<ProjectOption[]>('/workshop/v2/projects');
      setProjects(rows.filter((p) => p.status !== 'CANCELLED'));
    } catch {
      setProjects([]);
    }
  }

  async function createFromProject(project: ProjectOption) {
    setCreating(project.id);
    try {
      const draft = await api.post<WorkshopSalesInvoice>(`/workshop/tax/invoices/from-project/${project.id}`);
      setCreateOpen(false);
      router.push({ pathname: '/invoice/edit', params: { id: draft.id } });
    } catch (createError) {
      Alert.alert('Chưa lập được hoá đơn', errorText(createError, 'Vui lòng thử lại.'));
    } finally {
      setCreating(null);
    }
  }

  async function download(kind: 's1a' | 'invoices') {
    setDownloading(kind);
    try {
      if (kind === 's1a') await downloadAndShare(`/workshop/tax/reports/s1a.xlsx?year=${year}`, `so-doanh-thu-S1a-${year}.xlsx`, XLSX_MIME, `Sổ doanh thu ${year}`);
      else await downloadAndShare(`/workshop/tax/reports/invoices.xlsx?year=${year}`, `bang-ke-hoa-don-${year}.xlsx`, XLSX_MIME, `Bảng kê hoá đơn ${year}`);
    } catch (downloadError) {
      Alert.alert('Chưa tải được', errorText(downloadError, 'Vui lòng thử lại.'));
    } finally {
      setDownloading(null);
    }
  }

  const profile = ledger?.profile;
  const subtitle = profile?.legalName
    ? `${profile.legalName}${profile.taxCode ? ` · MST ${profile.taxCode}` : ''}`
    : 'Chưa khai hồ sơ thuế';

  return (
    <View style={wsStyles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <SubHeader
        title="Hoá đơn & thuế"
        subtitle={subtitle}
        onBack={() => router.back()}
        right={<IconButton icon="settings" label="Hồ sơ thuế" onPress={() => router.push('/tax-profile')} />}
      >
        <Segmented items={TABS} value={tab} onChange={setTab} />
      </SubHeader>

      <ScrollView
        contentContainerStyle={wsStyles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={ws.orange} />}
      >
        {tab !== 'invoices' ? (
          <View style={styles.yearBar}>
            <IconButton icon="chevron-left" label="Năm trước" onPress={() => setYear((y) => y - 1)} />
            <View style={wsStyles.grow}>
              <Text style={styles.yearTitle}>Năm {year}</Text>
              <Text style={styles.yearSub}>
                {ledger?.currentQuarter ? `Tính tới ${todayLabel()}` : 'Cả năm'} · {profile?.entityType === 'DN' ? 'doanh nghiệp' : 'hộ kinh doanh'}
              </Text>
            </View>
            <IconButton icon="chevron-right" label="Năm sau" disabled={year >= thisYear} onPress={() => setYear((y) => Math.min(thisYear, y + 1))} />
          </View>
        ) : null}

        {error ? <View style={styles.gapTop}><Banner tone="error" title="Chưa tải được" text={error} onPress={() => void load()} /></View> : null}
        {loading && !ledger ? <Loading /> : null}

        {ledger && profile && !profile.isComplete ? (
          <View style={styles.gapTop}>
            <Banner tone="orange" icon="file-text" title="Khai hồ sơ thuế" text="Cần mã số thuế, tên đăng ký và ký hiệu hoá đơn trước khi phát hành. Bấm để khai." onPress={() => router.push('/tax-profile')} />
          </View>
        ) : null}

        {ledger && tab === 'revenue' ? <RevenueTab ledger={ledger} banner={banner} /> : null}

        {ledger && tab === 'invoices' ? (
          <>
            <SearchBox value={query} onChangeText={setQuery} placeholder="Tìm số hoá đơn, khách, MST" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {FILTERS.map(([key, label]) => <Chip key={key} label={label} count={counts[key]} active={filter === key} onPress={() => setFilter(key)} />)}
            </ScrollView>
            {ledger.draftCount > 0 && filter === 'ALL' ? <Text style={wsStyles.hint}>{ledger.draftCount} hoá đơn nháp chưa phát hành, không tính vào doanh thu.</Text> : null}
            {invoices.length === 0 ? (
              <EmptyState icon="file-text" title={`Chưa có hoá đơn năm ${year}`} text="Lập hoá đơn từ công trình để lấy sẵn khách hàng và hạng mục." action={<Button label="Lập hoá đơn" icon="plus" onPress={() => void openCreate()} />} />
            ) : filtered.length === 0 ? (
              <EmptyState icon="search" title="Không có hoá đơn khớp" text="Thử đổi bộ lọc hoặc từ khoá." />
            ) : groups.map((group) => (
              <View key={group.key}>
                <Text style={styles.groupTitle}>{group.label.toUpperCase()} · {money(group.total)}</Text>
                <Card padded={false}>
                  {group.items.map((inv, index) => <InvoiceRow key={inv.id} inv={inv} first={index === 0} onPress={() => router.push(inv.status === 'DRAFT' ? { pathname: '/invoice/edit', params: { id: inv.id } } : { pathname: '/invoice/[id]', params: { id: inv.id } })} />)}
                </Card>
              </View>
            ))}
          </>
        ) : null}

        {ledger && tab === 'reports' ? (
          <>
            <SectionHead title="Gửi kế toán, cơ quan thuế" />
            <Card padded={false}>
              <ReportRow first icon="book-open" title="Sổ doanh thu S1a-HKD" sub={`Năm ${year} · theo từng hoá đơn · Excel`} busy={downloading === 's1a'} onPress={() => void download('s1a')} />
              <ReportRow icon="calendar" title={`Thông báo doanh thu năm ${year}`} sub="Số liệu để khai trên eTax Mobile" due={`Hạn ${dmy(ledger.annualNoticeDeadline)}`} onPress={() => setNoticeOpen(true)} />
              <ReportRow icon="file-text" title="Bảng kê hoá đơn bán ra" sub="Cả năm, gồm hoá đơn đã huỷ · Excel" busy={downloading === 'invoices'} onPress={() => void download('invoices')} />
            </Card>

            <SectionHead title={`Thuế tạm tính · năm ${year}`} sub={ledger.tax.exempt ? `Doanh thu chưa vượt ${compactMoney(ledger.threshold)}` : 'Doanh thu đã vượt ngưỡng'} />
            <Card padded={false}>
              <ValueLine first label="Doanh thu theo hoá đơn" value={money(ledger.totalInvoiced)} />
              <ValueLine label={`Thuế GTGT${ledger.tax.exempt ? '' : ` ${String(ledger.tax.vatRatePct).replace('.', ',')}%`}`} detail={ledger.tax.vatFormula} value={money(ledger.tax.vat)} />
              <ValueLine label={`Thuế TNCN${ledger.tax.exempt ? '' : ` ${String(ledger.tax.pitRatePct).replace('.', ',')}%`}`} detail={ledger.tax.pitFormula} value={ledger.tax.pit === null ? 'Cần chi phí' : money(ledger.tax.pit)} />
              <ValueLine strong label="Tổng thuế tạm tính" value={money(ledger.tax.total)} />
            </Card>
            {ledger.projectedTax ? (
              <Card style={styles.gapTop} padded={false}>
                <ValueLine first label={`Nếu giữ nhịp, cả năm đạt ${compactMoney(ledger.projectedTax.revenue)}`} detail={`GTGT ${ledger.projectedTax.vatFormula} · TNCN ${ledger.projectedTax.pitFormula}`} value={money(ledger.projectedTax.total)} tone="orange" />
              </Card>
            ) : null}
            <View style={styles.note}>
              <Icon name="info" size={14} color={ws.muted} />
              <Text style={styles.noteText}>
                Số liệu do app tổng hợp để tham khảo. Hộ kinh doanh chịu trách nhiệm số khai thuế.
                {ledger.rule.confirmed ? '' : ` Tỷ lệ ${String(ledger.rule.vatPct).replace('.', ',')}% / ${String(ledger.rule.pitPct).replace('.', ',')}% là mức quen dùng cho nghề nhôm kính, chưa xác nhận cho ${ledger.rule.year}; nhờ kế toán kiểm tra và sửa trong hồ sơ thuế.`}
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>

      {tab === 'invoices' && ledger ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Lập hoá đơn" onPress={() => void openCreate()} style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9 }]}>
          <Icon name="plus" size={18} color="#FFFFFF" />
          <Text style={styles.fabText}>Lập hoá đơn</Text>
        </Pressable>
      ) : null}

      <Sheet visible={createOpen} onClose={() => setCreateOpen(false)} title="Lập hoá đơn" sub="Chọn công trình để lấy sẵn khách và hạng mục" tall>
        <Pressable accessibilityRole="button" onPress={() => { setCreateOpen(false); router.push('/invoice/edit'); }} style={({ pressed }) => [styles.blankRow, pressed && { opacity: 0.85 }]}>
          <Icon name="file" size={18} color={ws.orangeText} />
          <View style={wsStyles.grow}><Text style={wsStyles.rowTitle}>Hoá đơn trống</Text><Text style={wsStyles.rowMeta}>Tự nhập người mua và từng dòng hàng</Text></View>
          <Icon name="chevron-right" size={18} color={ws.faint} />
        </Pressable>
        <Text style={styles.groupTitle}>TỪ CÔNG TRÌNH</Text>
        {projects === null ? <Loading /> : projects.length === 0 ? (
          <EmptyState icon="briefcase" title="Chưa có công trình" text="Tạo công trình ở mục Công trình, hoặc lập hoá đơn trống." />
        ) : (
          <Card padded={false}>
            {projects.map((project, index) => (
              <ListRow key={project.id} first={index === 0} label={`Lập hoá đơn từ ${project.code}`} onPress={creating ? undefined : () => void createFromProject(project)}>
                <View style={wsStyles.avatar}><Icon name="briefcase" size={16} color={ws.orangeText} /></View>
                <View style={wsStyles.grow}>
                  <Text style={wsStyles.rowTitle} numberOfLines={1}>{project.name}</Text>
                  <Text style={wsStyles.rowMeta} numberOfLines={1}>{project.code}{project.customerName ? ` · ${project.customerName}` : ''}</Text>
                </View>
                {creating === project.id ? <Text style={wsStyles.rowMeta}>Đang lập...</Text> : <Icon name="chevron-right" size={18} color={ws.faint} />}
              </ListRow>
            ))}
          </Card>
        )}
      </Sheet>

      <Sheet visible={noticeOpen} onClose={() => setNoticeOpen(false)} title={`Thông báo doanh thu năm ${year}`} sub={ledger ? `Nộp trên eTax Mobile trước ${dmy(ledger.annualNoticeDeadline)}` : undefined}>
        {ledger ? (
          <>
            <Card padded={false}>
              <ValueLine first label="Người nộp thuế" value={profile?.legalName || 'Chưa khai'} />
              <ValueLine label="Mã số thuế" value={profile?.taxCode || 'Chưa khai'} />
              <ValueLine label="Doanh thu theo hoá đơn" detail={`${ledger.invoiceCount} hoá đơn đã phát hành`} value={money(ledger.totalInvoiced)} strong />
              <ValueLine label="Tiền đã thu (đối chiếu)" detail={`${ledger.receiptCount} phiếu thu của công trình`} value={money(ledger.totalCollected)} />
            </Card>
            <Text style={wsStyles.hint}>Hộ có doanh thu năm từ {compactMoney(ledger.threshold)} trở xuống thông báo doanh thu thực tế trước 31/01 năm sau. Kiểm tra với kế toán trước khi nộp.</Text>
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

function RevenueTab({ ledger, banner }: { ledger: WorkshopTaxLedger; banner: ReturnType<typeof ledgerBanner> }) {
  const pct = Math.min(100, ledger.thresholdPct);
  return (
    <>
      <Card style={styles.gapTop}>
        <Text style={styles.cardLabel}>DOANH THU THEO HOÁ ĐƠN</Text>
        <Text style={styles.bigValue} numberOfLines={1} adjustsFontSizeToFit>{money(ledger.totalInvoiced)} <Text style={styles.bigSuffix}>/ {compactMoney(ledger.threshold)}</Text></Text>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${pct}%` }, ledger.thresholdPct > 100 && { backgroundColor: ws.danger }]} />
          <View style={styles.barMark} />
        </View>
        <View style={styles.barLegend}>
          <Text style={styles.barLegendText}>{ledger.thresholdPct.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}% ngưỡng</Text>
          <Text style={styles.barLegendText}>{ledger.remaining > 0 ? `Còn ${money(ledger.remaining)}` : `Vượt ${money(ledger.totalInvoiced - ledger.threshold)}`}</Text>
        </View>
      </Card>
      {banner ? <View style={styles.gapTop}><Banner tone={banner.tone} title={banner.title} text={banner.text} /></View> : null}
      <View style={[wsStyles.row, styles.gapTop]}>
        <Card style={wsStyles.half}><Text style={styles.kLabel}>Theo hoá đơn</Text><Text style={styles.kValue}>{compactMoney(ledger.totalInvoiced)}</Text><Text style={styles.kSub}>{ledger.invoiceCount} hoá đơn</Text></Card>
        <Card style={wsStyles.half}><Text style={styles.kLabel}>Tiền đã thu</Text><Text style={styles.kValue}>{compactMoney(ledger.totalCollected)}</Text><Text style={styles.kSub}>{ledger.receiptCount} phiếu thu</Text></Card>
      </View>

      <SectionHead title="Theo quý" />
      <Card padded={false}>
        <View style={styles.tHead}>
          <Text style={[styles.tHeadText, styles.tFirst]}>QUÝ</Text>
          <Text style={styles.tHeadText}>HOÁ ĐƠN</Text>
          <Text style={styles.tHeadText}>TIỀN THU</Text>
        </View>
        {ledger.quarters.map((q) => (
          <View key={q.quarter} style={[styles.tRow, ledger.currentQuarter === q.quarter && styles.tRowCurrent]}>
            <View style={styles.tFirst}>
              <Text style={styles.tQuarter}>Q{q.quarter}</Text>
              <Text style={styles.tQuarterSub}>{ledger.currentQuarter === q.quarter ? 'quý hiện tại' : QUARTER_MONTHS[q.quarter - 1]}</Text>
            </View>
            <Text style={styles.tCell}>{q.invoiced.toLocaleString('vi-VN')}</Text>
            <Text style={styles.tCell}>{q.collected.toLocaleString('vi-VN')}</Text>
          </View>
        ))}
        <View style={[styles.tRow, styles.tRowSum]}>
          <Text style={[styles.tQuarter, styles.tFirst]}>Cả năm</Text>
          <Text style={[styles.tCell, styles.tStrong]}>{ledger.totalInvoiced.toLocaleString('vi-VN')}</Text>
          <Text style={[styles.tCell, styles.tStrong]}>{ledger.totalCollected.toLocaleString('vi-VN')}</Text>
        </View>
      </Card>
      <View style={styles.note}>
        <Icon name="info" size={14} color={ws.muted} />
        <Text style={styles.noteText}>Ngưỡng {compactMoney(ledger.threshold)} tính theo hoá đơn đã phát hành (NĐ 141/2026). Tiền thu lấy từ phiếu thu của công trình, dùng để đối chiếu.</Text>
      </View>
    </>
  );
}

function InvoiceRow({ inv, first, onPress }: { inv: WorkshopSalesInvoiceSummary; first: boolean; onPress: () => void }) {
  const meta = statusMeta(inv);
  const icon: IconName = inv.status === 'DRAFT' ? 'edit-2' : inv.status === 'ISSUED' ? 'file-text' : 'x';
  const crossed = inv.status === 'CANCELLED' || inv.status === 'REPLACED';
  const sub = inv.status === 'DRAFT'
    ? `Nháp${inv.projectCode ? ` · từ ${inv.projectCode}` : ''}${inv.replacesNumber ? ` · thay số ${inv.replacesNumber}` : ''}`
    : [`${inv.series} · ${inv.number}`, dmy(inv.issueDate).slice(0, 5), inv.buyerTaxCode ? `MST ${inv.buyerTaxCode}` : '', inv.status === 'REPLACED' && inv.replacedByNumber ? `thay bằng ${inv.replacedByNumber}` : '', inv.status === 'CANCELLED' && inv.cancelReason ? `huỷ: ${inv.cancelReason}` : '']
      .filter(Boolean).join(' · ');
  return (
    <ListRow first={first} onPress={onPress} label={`Mở hoá đơn ${inv.number ?? 'nháp'} ${inv.buyerName}`}>
      <View style={[wsStyles.avatar, inv.status === 'DRAFT' && styles.avatarGrey, crossed && styles.avatarRed]}>
        <Icon name={icon} size={16} color={inv.status === 'DRAFT' ? '#667085' : crossed ? ws.dangerText : ws.orangeText} />
      </View>
      <View style={wsStyles.grow}>
        <Text style={wsStyles.rowTitle} numberOfLines={1}>{inv.buyerName || 'Chưa có người mua'}</Text>
        <Text style={wsStyles.rowMeta} numberOfLines={1}>{sub}</Text>
      </View>
      <View style={styles.amountCol}>
        <Text style={[styles.amount, crossed && styles.amountCrossed]}>{inv.total.toLocaleString('vi-VN')}</Text>
        <InvoiceStatusPill label={meta.label} tone={meta.tone} />
      </View>
    </ListRow>
  );
}

function ReportRow({ icon, title, sub, due, busy, first, onPress }: { icon: IconName; title: string; sub: string; due?: string; busy?: boolean; first?: boolean; onPress: () => void }) {
  return (
    <ListRow first={first} onPress={busy ? undefined : onPress} label={title}>
      <View style={wsStyles.avatar}><Icon name={icon} size={16} color={ws.orangeText} /></View>
      <View style={wsStyles.grow}>
        <Text style={wsStyles.rowTitle}>{title}</Text>
        <Text style={wsStyles.rowMeta}>{sub}</Text>
      </View>
      {due ? <Text style={styles.due}>{due}</Text> : busy ? <Text style={wsStyles.rowMeta}>Đang tải...</Text> : <Icon name="download" size={18} color={ws.muted} />}
    </ListRow>
  );
}

const styles = StyleSheet.create({
  gapTop: { marginTop: 10 },
  yearBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  yearTitle: { color: ws.ink, fontSize: 15, fontWeight: '900' },
  yearSub: { color: ws.muted, fontSize: 11.5, marginTop: 1 },
  cardLabel: { color: ws.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  bigValue: { color: ws.ink, fontSize: 24, fontWeight: '900', marginTop: 4 },
  bigSuffix: { color: ws.muted, fontSize: 13, fontWeight: '700' },
  bar: { height: 10, borderRadius: 99, backgroundColor: '#F2F4F7', marginTop: 12, overflow: 'hidden', position: 'relative' },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 99, backgroundColor: ws.orange },
  barMark: { position: 'absolute', left: '80%', top: 0, bottom: 0, width: 2, backgroundColor: ws.warning },
  barLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  barLegendText: { color: ws.muted, fontSize: 11, fontWeight: '600' },
  kLabel: { color: ws.muted, fontSize: 11, fontWeight: '700' },
  kValue: { color: ws.ink, fontSize: 17, fontWeight: '900', marginTop: 2 },
  kSub: { color: ws.muted, fontSize: 11, marginTop: 1 },
  tHead: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  tHeadText: { flex: 1, textAlign: 'right', color: ws.muted, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },
  tFirst: { flex: 0.7, textAlign: 'left' },
  tRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: ws.lineSoft },
  tRowCurrent: { backgroundColor: '#FFFBF7' },
  tRowSum: { backgroundColor: '#F9FAFB' },
  tQuarter: { color: ws.ink, fontSize: 13, fontWeight: '800' },
  tQuarterSub: { color: ws.muted, fontSize: 10.5, marginTop: 1 },
  tCell: { flex: 1, textAlign: 'right', color: ws.text, fontSize: 12.5, fontVariant: ['tabular-nums'] },
  tStrong: { color: ws.ink, fontWeight: '900' },
  note: { flexDirection: 'row', gap: 8, marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: ws.line },
  noteText: { flex: 1, color: ws.muted, fontSize: 11.5, lineHeight: 16 },
  chips: { gap: 6, paddingVertical: 10 },
  groupTitle: { color: ws.muted, fontSize: 11.5, fontWeight: '900', letterSpacing: 0.4, marginTop: 12, marginBottom: 6, marginHorizontal: 2 },
  avatarGrey: { backgroundColor: '#F2F4F7' },
  avatarRed: { backgroundColor: ws.dangerBg },
  amountCol: { alignItems: 'flex-end', gap: 4, maxWidth: 130 },
  amount: { color: ws.ink, fontSize: 13.5, fontWeight: '900', fontVariant: ['tabular-nums'] },
  amountCrossed: { color: ws.faint, textDecorationLine: 'line-through' },
  due: { color: ws.warning, fontSize: 11, fontWeight: '800' },
  fab: { position: 'absolute', right: 16, bottom: 24, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, borderRadius: 14, backgroundColor: ws.orange, shadowColor: ws.orange, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  fabText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  blankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: ws.orangeLine, backgroundColor: ws.orangeSoft },
});
