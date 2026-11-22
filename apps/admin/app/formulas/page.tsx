'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { FilePlus2, ImagePlus, Plus, Save, Send, Trash2, X } from 'lucide-react';
import { filterCuttingFormulaSystems } from '@eurohouse/types';
import { AdminPage } from '@/AdminPage';
import { AuthenticationError, apiDelete, apiGet, apiSend, apiUrl, assetUrl } from '@/lib/api';
import { getToken } from '@/auth';
import { eyebrowStyle, pageTitleStyle, ui } from '@/ui';

type AluSystem = { id: string; code: string; name: string };
type CatalogProfile = { code: string; name: string };
type CatalogSystem = AluSystem & { profiles: CatalogProfile[] };
type InputField = { key: string; label: string; unit: string; type?: 'number' | 'boolean'; required: boolean; defaultValue?: number | string };
type CutRule = { profileSystemCode?: string; profileCode: string; profileName: string; lengthFormula: string; quantityFormula: string; cutAngle: string; note: string };
type GlassRule = { name: string; widthFormula: string; heightFormula: string; quantityFormula: string; note: string };
type FormulaStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
type VerificationStatus = 'CANDIDATE' | 'SOURCE_VERIFIED' | 'FIELD_VERIFIED';
type ManagedFormula = {
  id: string; systemId: string; systemCode: string; systemName: string; windowTypeName: string;
  templateName: string; description: string; imageUrl?: string; status: FormulaStatus; revision: number;
  inputFields?: InputField[]; cutRules?: CutRule[]; glassRules?: GlassRule[];
  sourceRef?: string; verificationStatus?: VerificationStatus;
};
type EditorState = {
  id?: string; aluSystemId: string; name: string; type: string; description: string; imageUrl?: string;
  status: FormulaStatus; inputFields: InputField[]; cutRules: CutRule[]; glassRules: GlassRule[];
  sourceRef: string; verificationStatus: VerificationStatus;
};

const blankInput = (): InputField => ({ key: '', label: '', unit: 'mm', type: 'number', required: true, defaultValue: '' });
const blankRule = (): CutRule => ({ profileSystemCode: '', profileCode: '', profileName: '', lengthFormula: '', quantityFormula: '1', cutAngle: '90-90', note: '' });
const blankGlassRule = (): GlassRule => ({ name: '', widthFormula: '', heightFormula: '', quantityFormula: '1', note: '' });
const defaultInputs = (): InputField[] => [
  { key: 'W', label: 'Chiều rộng bộ cửa', unit: 'mm', type: 'number', required: true },
  { key: 'H', label: 'Chiều cao bộ cửa', unit: 'mm', type: 'number', required: true },
  { key: 'Q', label: 'Số lượng bộ', unit: 'bộ', type: 'number', required: true, defaultValue: 1 },
];
const emptyEditor = (systemId: string): EditorState => ({ aluSystemId: systemId, name: '', type: '', description: '', status: 'DRAFT', inputFields: defaultInputs(), cutRules: [blankRule()], glassRules: [], sourceRef: 'WebAdmin manual entry', verificationStatus: 'CANDIDATE' });

const inputStyle: CSSProperties = { width: '100%', minHeight: 42, border: `1px solid ${ui.border}`, borderRadius: 6, padding: '9px 10px', background: ui.surface, color: ui.text, font: 'inherit' };
const iconButton: CSSProperties = { width: 38, height: 38, display: 'grid', placeItems: 'center', border: `1px solid ${ui.border}`, borderRadius: 6, background: ui.surface, color: ui.textMuted, cursor: 'pointer', flex: '0 0 auto' };

export default function FormulasPage() {
  return <AdminPage><FormulasContent /></AdminPage>;
}

function reportError(error: unknown, fallback: string) {
  if (error instanceof AuthenticationError) return;
  alert(error instanceof Error ? error.message : fallback);
}

function FormulasContent() {
  const [systems, setSystems] = useState<AluSystem[]>([]);
  const [catalog, setCatalog] = useState<CatalogSystem[]>([]);
  const [activeSystemId, setActiveSystemId] = useState('');
  const [items, setItems] = useState<ManagedFormula[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [systemRows, catalogRows] = await Promise.all([
          apiGet<AluSystem[]>('/system-formulas/systems'),
          apiGet<CatalogSystem[]>('/catalog/systems'),
        ]);
        const visibleSystemRows = filterCuttingFormulaSystems(systemRows);
        const visibleCatalogRows = filterCuttingFormulaSystems(catalogRows);
        setSystems(visibleSystemRows);
        setCatalog(visibleCatalogRows);
        if (visibleSystemRows[0]) setActiveSystemId(visibleSystemRows[0].id);
      } catch (error) {
        reportError(error, 'Không tải được dữ liệu công thức.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => { if (activeSystemId) void loadItems(activeSystemId); }, [activeSystemId]);

  async function loadItems(systemId: string, keepId?: string) {
    try {
      const rows = await apiGet<ManagedFormula[]>(`/system-formulas/admin/managed/templates?aluSystemId=${encodeURIComponent(systemId)}`);
      setItems(rows);
      if (keepId) {
        const detail = await apiGet<ManagedFormula>(`/system-formulas/admin/managed/templates/${keepId}`);
        openEditor(detail);
      } else setEditor(null);
    } catch (error) {
      reportError(error, 'Không tải được danh sách công thức.');
    }
  }

  function openEditor(item: ManagedFormula) {
    setEditor({
      id: item.id,
      aluSystemId: item.systemId,
      name: item.templateName,
      type: item.windowTypeName,
      description: item.description || '',
      imageUrl: item.imageUrl,
      status: item.status,
      inputFields: item.inputFields?.length ? item.inputFields : defaultInputs(),
      cutRules: item.cutRules?.length
        ? item.cutRules.map((rule) => ({ ...rule, profileSystemCode: rule.profileSystemCode || item.systemCode }))
        : [{ ...blankRule(), profileSystemCode: item.systemCode }],
      glassRules: item.glassRules || [],
      sourceRef: item.sourceRef || 'WebAdmin manual entry',
      verificationStatus: item.verificationStatus || 'CANDIDATE',
    });
  }

  async function editItem(item: ManagedFormula) {
    try { openEditor(await apiGet<ManagedFormula>(`/system-formulas/admin/managed/templates/${item.id}`)); }
    catch (error) { reportError(error, 'Không tải được công thức.'); }
  }

  async function save(status: FormulaStatus) {
    if (!editor) return;
    setSaving(true);
    try {
      const body = { ...editor, status };
      const saved = editor.id
        ? await apiSend<{ id: string }>(`/system-formulas/admin/managed/templates/${editor.id}`, 'PUT', body)
        : await apiSend<{ id: string }>('/system-formulas/admin/managed/templates', 'POST', body);
      await loadItems(editor.aluSystemId, saved.id);
      alert(status === 'PUBLISHED' ? 'Đã phát hành công thức cho toàn bộ App CSSX.' : 'Đã lưu bản nháp công thức.');
    } catch (error) { reportError(error, 'Không lưu được công thức.'); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!editor?.id || !confirm(`Xóa công thức “${editor.name}”?`)) return;
    try { await apiDelete(`/system-formulas/admin/managed/templates/${editor.id}`); await loadItems(activeSystemId); }
    catch (error) { reportError(error, 'Không xóa được công thức.'); }
  }

  async function uploadImage(file?: File) {
    if (!file || !editor?.id) return;
    setUploading(true);
    try {
      const form = new FormData(); form.append('image', file);
      const response = await fetch(`${apiUrl}/system-formulas/admin/managed/templates/${editor.id}/image`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: form });
      if (!response.ok) { const payload = await response.json().catch(() => null); throw new Error(payload?.message || `Tải ảnh thất bại (${response.status}).`); }
      await loadItems(activeSystemId, editor.id);
    } catch (error) { alert(error instanceof Error ? error.message : 'Không tải được ảnh mẫu cửa.'); }
    finally { setUploading(false); if (imageInputRef.current) imageInputRef.current.value = ''; }
  }

  function updateField(index: number, patch: Partial<InputField>) {
    if (editor) setEditor({ ...editor, inputFields: editor.inputFields.map((field, row) => row === index ? { ...field, ...patch } : field) });
  }
  function updateRule(index: number, patch: Partial<CutRule>) {
    if (editor) setEditor({ ...editor, cutRules: editor.cutRules.map((rule, row) => row === index ? { ...rule, ...patch } : rule) });
  }
  function updateGlassRule(index: number, patch: Partial<GlassRule>) {
    if (editor) setEditor({ ...editor, glassRules: editor.glassRules.map((rule, row) => row === index ? { ...rule, ...patch } : rule) });
  }

  return <div>
    <p style={eyebrowStyle}>DỮ LIỆU KỸ THUẬT DÙNG CHUNG</p>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
      <div><h1 style={pageTitleStyle}>Cơ sở dữ liệu công thức cắt</h1><p style={{ color: ui.textMuted, margin: '8px 0 0', maxWidth: 760 }}>WebAdmin định nghĩa mẫu cửa, trường kích thước và quy tắc sinh mã cắt. Chỉ bản đã phát hành mới hiển thị đồng bộ trên App Mobile.</p></div>
      <button onClick={() => setEditor(emptyEditor(activeSystemId))} disabled={!activeSystemId} style={{ border: 0, borderRadius: 6, background: ui.brand, color: '#172033', minHeight: 42, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, cursor: 'pointer' }}><FilePlus2 size={18} /> Tạo công thức</button>
    </div>

    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, marginBottom: 10 }}>
      {systems.map((system) => <button key={system.id} onClick={() => setActiveSystemId(system.id)} style={{ border: `1px solid ${activeSystemId === system.id ? ui.brand : ui.border}`, background: activeSystemId === system.id ? ui.brandSoft : ui.surface, color: activeSystemId === system.id ? ui.brandText : ui.text, borderRadius: 6, padding: '9px 12px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>{system.code} · {system.name}</button>)}
    </div>

    {loading ? <p>Đang tải dữ liệu...</p> : <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 320px) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
      <section style={{ borderTop: `3px solid ${ui.brand}`, background: ui.surface, boxShadow: ui.shadowLg }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${ui.border}`, fontWeight: 900 }}>Công thức trong phân hệ <span style={{ color: ui.textMuted }}>({items.length})</span></div>
        {items.length === 0 ? <p style={{ color: ui.textMuted, padding: 16 }}>Chưa có công thức Eurohouse. Tạo bản đầu tiên để nhập liệu.</p> : items.map((item) => <button key={item.id} onClick={() => void editItem(item)} style={{ width: '100%', border: 0, borderBottom: `1px solid ${ui.border}`, background: editor?.id === item.id ? ui.brandSoft : ui.surface, padding: '13px 16px', textAlign: 'left', cursor: 'pointer' }}><span style={{ display: 'block', color: ui.text, fontWeight: 850 }}>{item.templateName}</span><span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: ui.textMuted, fontSize: 12, marginTop: 5 }}><span>{item.windowTypeName}</span><b style={{ color: item.status === 'PUBLISHED' ? ui.success : ui.brandText }}>{item.status === 'PUBLISHED' ? 'Đang dùng' : item.status === 'DRAFT' ? 'Bản nháp' : 'Lưu trữ'}</b></span></button>)}
      </section>

      {!editor ? <div style={{ minHeight: 320, border: `1px dashed ${ui.border}`, display: 'grid', placeItems: 'center', color: ui.textMuted, background: ui.surface }}>Chọn một công thức hoặc tạo công thức mới.</div> : <section style={{ background: ui.surface, borderTop: `3px solid ${ui.brand}`, boxShadow: ui.shadowLg }}>
        <div style={{ padding: 18, borderBottom: `1px solid ${ui.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><div><h2 style={{ margin: 0, fontSize: 19, color: ui.text }}>{editor.id ? 'Chỉnh sửa công thức' : 'Công thức mới'}</h2>{editor.id ? <small style={{ color: ui.textMuted }}>Revision được tăng sau mỗi lần lưu.</small> : null}</div><div style={{ display: 'flex', gap: 8 }}>{editor.id ? <button title="Xóa công thức" onClick={() => void remove()} style={{ ...iconButton, color: ui.danger }}><Trash2 size={17} /></button> : null}<button title="Đóng" onClick={() => setEditor(null)} style={iconButton}><X size={18} /></button></div></div>

        <div style={{ padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14 }}><Field label="Tên mẫu cửa *"><input style={inputStyle} value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} placeholder="VD: Cửa đi 1 cánh mở quay" /></Field><Field label="Loại cửa *"><input style={inputStyle} value={editor.type} onChange={(event) => setEditor({ ...editor, type: event.target.value })} placeholder="VD: Cửa đi mở quay" /></Field></div>
          <Field label="Mô tả kiểu cửa (bắt buộc nếu chưa có ảnh)"><textarea style={{ ...inputStyle, minHeight: 82, resize: 'vertical' }} value={editor.description} onChange={(event) => setEditor({ ...editor, description: event.target.value })} placeholder="Mô tả số cánh, chiều mở, đố và phạm vi áp dụng..." /></Field>
          <Field label="Nguồn kỹ thuật"><input style={{ ...inputStyle, background: ui.surfaceMuted }} value={editor.sourceRef} readOnly title={editor.sourceRef} /></Field>
          <div style={{ margin: '-4px 0 18px', padding: '10px 12px', border: `1px solid ${editor.verificationStatus === 'FIELD_VERIFIED' ? ui.success : ui.border}`, background: editor.verificationStatus === 'CANDIDATE' ? '#fff7ed' : ui.surfaceMuted, color: ui.text, fontSize: 13 }}><b>Trạng thái kiểm chứng: </b>{editor.verificationStatus === 'FIELD_VERIFIED' ? 'Đã kiểm nghiệm thực tế' : editor.verificationStatus === 'SOURCE_VERIFIED' ? 'Đã đối chiếu đúng file nguồn, chờ kiểm nghiệm thực tế' : 'Ứng viên kỹ thuật, cần duyệt lại trước khi dùng sản xuất'}</div>

          <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr)', gap: 14, alignItems: 'stretch', marginBottom: 24 }}><div style={{ height: 140, border: `1px solid ${ui.border}`, background: ui.surfaceMuted, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>{editor.imageUrl ? <img src={assetUrl(editor.imageUrl)} alt={editor.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <ImagePlus size={30} color={ui.textFaint} />}</div><div style={{ border: `1px solid ${ui.border}`, padding: 14, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start' }}><b style={{ color: ui.text }}>Ảnh mẫu cửa</b><p style={{ color: ui.textMuted, margin: '5px 0 12px', fontSize: 13 }}>Lưu bản nháp trước, sau đó tải PNG/JPG/WebP. Ảnh này sẽ hiển thị cho toàn bộ CSSX.</p><input ref={imageInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadImage(event.target.files?.[0])} /><button disabled={!editor.id || uploading} onClick={() => imageInputRef.current?.click()} style={{ border: `1px solid ${ui.border}`, background: ui.surface, borderRadius: 6, minHeight: 38, padding: '0 12px', fontWeight: 800, cursor: editor.id ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 7 }}><ImagePlus size={16} /> {uploading ? 'Đang tải...' : 'Chọn ảnh'}</button></div></div>

          <EditorSection title="Trường kích thước" description="Mã trường viết hoa, không dấu. W, H và Q là quy ước dễ đọc; có thể thêm B1, H1, GAP..." action={<button onClick={() => setEditor({ ...editor, inputFields: [...editor.inputFields, blankInput()] })} style={iconButton} title="Thêm trường"><Plus size={17} /></button>}>
            <div style={{ display: 'grid', gridTemplateColumns: '100px minmax(170px, 1fr) 95px 80px 105px 110px 40px', gap: 8, color: ui.textMuted, fontSize: 11, fontWeight: 800, padding: '0 0 7px' }}><span>MÃ BIẾN</span><span>TÊN HIỂN THỊ</span><span>KIỂU</span><span>ĐƠN VỊ</span><span>MẶC ĐỊNH</span><span>BẮT BUỘC</span><span /></div>
            {editor.inputFields.map((field, index) => (
              <div key={index} style={{ display: 'grid', gridTemplateColumns: '100px minmax(170px, 1fr) 95px 80px 105px 110px 40px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input style={inputStyle} value={field.key} onChange={(event) => updateField(index, { key: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })} placeholder="W" />
                <input style={inputStyle} value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} placeholder="Chiều rộng" />
                <select style={inputStyle} value={field.type || 'number'} onChange={(event) => updateField(index, { type: event.target.value as InputField['type'], unit: event.target.value === 'boolean' ? '' : field.unit || 'mm' })}><option value="number">Số</option><option value="boolean">Có/không</option></select>
                <input style={inputStyle} value={field.unit} disabled={field.type === 'boolean'} onChange={(event) => updateField(index, { unit: event.target.value })} placeholder="mm" />
                <input style={inputStyle} type="number" min="0" max={field.type === 'boolean' ? 1 : undefined} value={field.defaultValue ?? ''} onChange={(event) => updateField(index, { defaultValue: event.target.value })} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: ui.text, fontSize: 13 }}><input type="checkbox" checked={field.required} onChange={(event) => updateField(index, { required: event.target.checked })} /> Bắt buộc</label>
                <button title="Xóa trường" onClick={() => setEditor({ ...editor, inputFields: editor.inputFields.filter((_, row) => row !== index) })} style={{ ...iconButton, color: ui.danger }}><Trash2 size={15} /></button>
              </div>
            ))}
          </EditorSection>

          <EditorSection title="Quy tắc sinh mã cắt" description="Mỗi dòng có thể lấy mã thanh từ một phân hệ khác, ví dụ ô fix của EU-TQ sử dụng khung vách EU-55." action={<button onClick={() => setEditor({ ...editor, cutRules: [...editor.cutRules, { ...blankRule(), profileSystemCode: catalog.find((system) => system.id === editor.aluSystemId)?.code || '' }] })} style={iconButton} title="Thêm quy tắc"><Plus size={17} /></button>}>
            <div style={{ display: 'grid', gridTemplateColumns: '105px 125px minmax(145px, 1fr) 145px 115px 95px 40px', gap: 8, color: ui.textMuted, fontSize: 11, fontWeight: 800, padding: '0 0 7px' }}><span>HỆ NHÔM</span><span>MÃ THANH</span><span>TÊN THANH</span><span>CHIỀU DÀI</span><span>SỐ LƯỢNG</span><span>GÓC CẮT</span><span /></div>
            {editor.cutRules.map((rule, index) => {
              const ruleSystemCode = rule.profileSystemCode || catalog.find((system) => system.id === editor.aluSystemId)?.code || '';
              const ruleProfiles = catalog.find((system) => system.code === ruleSystemCode)?.profiles || [];
              return <div key={index} style={{ borderTop: `1px solid ${ui.border}`, padding: '9px 0', display: 'grid', gridTemplateColumns: '105px 125px minmax(145px, 1fr) 145px 115px 95px 40px', gap: 8, alignItems: 'center' }}>
                <select style={inputStyle} value={ruleSystemCode} onChange={(event) => updateRule(index, { profileSystemCode: event.target.value, profileCode: '', profileName: '' })}><option value="">Chọn hệ</option>{catalog.map((system) => <option key={system.code} value={system.code}>{system.code}</option>)}</select>
                <select style={inputStyle} value={rule.profileCode} onChange={(event) => { const selected = ruleProfiles.find((profile) => profile.code === event.target.value); updateRule(index, { profileSystemCode: ruleSystemCode, profileCode: event.target.value, profileName: selected?.name || '' }); }}><option value="">Chọn mã</option>{ruleProfiles.map((profile) => <option key={profile.code} value={profile.code}>{profile.code}</option>)}</select>
                <input style={inputStyle} value={rule.profileName} readOnly placeholder="Tự lấy từ catalog" />
                <input style={inputStyle} value={rule.lengthFormula} onChange={(event) => updateRule(index, { lengthFormula: event.target.value.toUpperCase() })} placeholder="H-50" />
                <input style={inputStyle} value={rule.quantityFormula} onChange={(event) => updateRule(index, { quantityFormula: event.target.value.toUpperCase() })} placeholder="2*Q" />
                <select style={inputStyle} value={rule.cutAngle} onChange={(event) => updateRule(index, { cutAngle: event.target.value })}><option>90-90</option><option>45-45</option><option>45-90</option><option>90-45</option></select>
                <button title="Xóa quy tắc" onClick={() => setEditor({ ...editor, cutRules: editor.cutRules.filter((_, row) => row !== index) })} style={{ ...iconButton, color: ui.danger }}><Trash2 size={15} /></button>
                <input style={{ ...inputStyle, gridColumn: '1 / 7' }} value={rule.note} onChange={(event) => updateRule(index, { note: event.target.value })} placeholder="Ghi chú gia công hoặc vị trí thanh (không bắt buộc)" />
              </div>;
            })}
          </EditorSection>

          <EditorSection title="Quy tắc kích thước kính" description="Mỗi dòng sinh chiều rộng, chiều cao và số lượng kính từ cùng bộ biến kích thước." action={<button onClick={() => setEditor({ ...editor, glassRules: [...editor.glassRules, blankGlassRule()] })} style={iconButton} title="Thêm kính"><Plus size={17} /></button>}>
            {editor.glassRules.length === 0 ? <p style={{ color: ui.textMuted, fontSize: 13 }}>Chưa có quy tắc kính cho mẫu cửa này.</p> : null}
            {editor.glassRules.map((rule, index) => <div key={index} style={{ borderTop: `1px solid ${ui.border}`, padding: '9px 0', display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) 150px 150px 120px 40px', gap: 8, alignItems: 'center' }}><input style={inputStyle} value={rule.name} onChange={(event) => updateGlassRule(index, { name: event.target.value })} placeholder="Kính cánh quay" /><input style={inputStyle} value={rule.widthFormula} onChange={(event) => updateGlassRule(index, { widthFormula: event.target.value.toUpperCase() })} placeholder="W-170" /><input style={inputStyle} value={rule.heightFormula} onChange={(event) => updateGlassRule(index, { heightFormula: event.target.value.toUpperCase() })} placeholder="H-258" /><input style={inputStyle} value={rule.quantityFormula} onChange={(event) => updateGlassRule(index, { quantityFormula: event.target.value.toUpperCase() })} placeholder="2*Q" /><button title="Xóa quy tắc kính" onClick={() => setEditor({ ...editor, glassRules: editor.glassRules.filter((_, row) => row !== index) })} style={{ ...iconButton, color: ui.danger }}><Trash2 size={15} /></button><input style={{ ...inputStyle, gridColumn: '1 / 5' }} value={rule.note} onChange={(event) => updateGlassRule(index, { note: event.target.value })} placeholder="Ghi chú kính (không bắt buộc)" /></div>)}
          </EditorSection>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderTop: `1px solid ${ui.border}`, paddingTop: 16 }}><span style={{ color: ui.textMuted, fontSize: 12, maxWidth: 520 }}>Bản nháp không xuất hiện trên Mobile. Khi phát hành, engine API dùng cùng một revision cho toàn bộ người dùng.</span><div style={{ display: 'flex', gap: 8 }}><button disabled={saving} onClick={() => void save('DRAFT')} style={{ border: `1px solid ${ui.border}`, background: ui.surface, borderRadius: 6, minHeight: 42, padding: '0 14px', fontWeight: 850, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}><Save size={17} /> Lưu nháp</button><button disabled={saving} onClick={() => void save('PUBLISHED')} style={{ border: 0, background: ui.brand, color: '#172033', borderRadius: 6, minHeight: 42, padding: '0 16px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}><Send size={17} /> Phát hành</button></div></div>
        </div>
      </section>}
    </div>}
  </div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label style={{ display: 'block', marginBottom: 14 }}><span style={{ display: 'block', color: ui.text, fontWeight: 800, fontSize: 13, marginBottom: 6 }}>{label}</span>{children}</label>;
}

function EditorSection({ title, description, action, children }: { title: string; description: string; action: ReactNode; children: ReactNode }) {
  return <div style={{ marginBottom: 25 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}><div><h3 style={{ color: ui.text, fontSize: 16, margin: 0 }}>{title}</h3><p style={{ color: ui.textMuted, fontSize: 12, margin: '4px 0 0' }}>{description}</p></div>{action}</div>{children}</div>;
}
