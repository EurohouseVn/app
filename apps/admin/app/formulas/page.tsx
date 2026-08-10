'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { ui } from '@/ui';
import { apiGet, apiSend, apiUrl, assetUrl } from '@/lib/api';
import { getToken } from '@/auth';
import { Check, UploadCloud, FileSpreadsheet, Loader2, ImagePlus, Star } from 'lucide-react';

interface AluSystem {
  id: string;
  code: string;
  name: string;
}

interface DoorDesign {
  id: string;
  name: string;
  type: string;
  imageUrl?: string;
}

interface SystemFormula {
  id: string;
  aluSystemId: string;
  doorModelId: string;
  excelFilePath?: string;
}

interface TemplateType {
  id: string;
  name: string;
  templateCount: number;
  popularCount?: number;
}

interface FormulaTemplate {
  id: string;
  templateId: string;
  systemName: string;
  sourceSystemName?: string;
  windowTypeName: string;
  templateName: string;
  imageUrl?: string;
  variantCount?: number;
  isPopular?: boolean;
}

export default function FormulasPage() {
  const [systems, setSystems] = useState<AluSystem[]>([]);
  const [designs, setDesigns] = useState<DoorDesign[]>([]);
  const [formulas, setFormulas] = useState<SystemFormula[]>([]);
  
  const [activeSystemId, setActiveSystemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [uploading, setUploading] = useState<string | null>(null);
  const [pendingUploadId, setPendingUploadId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [pendingImageUploadId, setPendingImageUploadId] = useState<string | null>(null);

  const [referenceSystems, setReferenceSystems] = useState<AluSystem[]>([]);
  const [activeReferenceSystemId, setActiveReferenceSystemId] = useState<string | null>(null);
  const [templateTypes, setTemplateTypes] = useState<TemplateType[]>([]);
  const [activeTemplateTypeId, setActiveTemplateTypeId] = useState<string | null>(null);
  const [referenceTemplates, setReferenceTemplates] = useState<FormulaTemplate[]>([]);
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sysData, desData, referenceSysData] = await Promise.all([
        apiGet<AluSystem[]>('/system-formulas/systems'),
        apiGet<DoorDesign[]>('/system-formulas/door-designs'),
        apiGet<AluSystem[]>('/system-formulas/template-systems')
      ]);
      setSystems(sysData || []);
      setDesigns(desData || []);
      setReferenceSystems(referenceSysData || []);
      if (sysData && sysData.length > 0) {
        setActiveSystemId(sysData[0].id);
        fetchFormulas(sysData[0].id);
      }
      if (referenceSysData && referenceSysData.length > 0) {
        setActiveReferenceSystemId(referenceSysData[0].id);
        fetchTemplateTypes(referenceSysData[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFormulas = async (systemId: string) => {
    try {
      const data = await apiGet<SystemFormula[]>(`/system-formulas/systems/${systemId}/formulas`);
      setFormulas(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTemplateTypes = async (systemId: string) => {
    try {
      setReferenceLoading(true);
      const data = await apiGet<TemplateType[]>(`/system-formulas/template-types?eurohouseSystemId=${encodeURIComponent(systemId)}`);
      setTemplateTypes(data || []);
      const firstType = data?.[0];
      setActiveTemplateTypeId(firstType?.id || null);
      if (firstType) {
        fetchReferenceTemplates(systemId, firstType.name);
      } else {
        setReferenceTemplates([]);
      }
    } catch (err) {
      console.error(err);
      setTemplateTypes([]);
      setReferenceTemplates([]);
    } finally {
      setReferenceLoading(false);
    }
  };

  const fetchReferenceTemplates = async (systemId: string, typeName: string) => {
    try {
      setReferenceLoading(true);
      const data = await apiGet<FormulaTemplate[]>(`/system-formulas/templates?eurohouseSystemId=${encodeURIComponent(systemId)}&windowTypeName=${encodeURIComponent(typeName)}`);
      setReferenceTemplates(data || []);
    } catch (err) {
      console.error(err);
      setReferenceTemplates([]);
    } finally {
      setReferenceLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSystemClick = (id: string) => {
    setActiveSystemId(id);
    fetchFormulas(id);
  };

  const handleReferenceSystemClick = (id: string) => {
    setActiveReferenceSystemId(id);
    setActiveTemplateTypeId(null);
    setReferenceTemplates([]);
    fetchTemplateTypes(id);
  };

  const handleTemplateTypeClick = (type: TemplateType) => {
    if (!activeReferenceSystemId) return;
    setActiveTemplateTypeId(type.id);
    fetchReferenceTemplates(activeReferenceSystemId, type.name);
  };

  const toggleTemplatePopular = async (template: FormulaTemplate) => {
    try {
      setSavingTemplateId(template.templateId);
      const nextPopular = !template.isPopular;
      setReferenceTemplates((current) => current.map((item) => item.templateId === template.templateId ? { ...item, isPopular: nextPopular } : item));
      await apiSend(`/formulas/templates/${template.templateId}/popular`, 'POST', { isPopular: nextPopular });
      setTemplateTypes((current) => current.map((type) => {
        if (type.id !== activeTemplateTypeId) return type;
        const currentPopular = type.popularCount || 0;
        return { ...type, popularCount: Math.max(0, currentPopular + (nextPopular ? 1 : -1)) };
      }));
    } catch (err) {
      console.error(err);
      setReferenceTemplates((current) => current.map((item) => item.templateId === template.templateId ? { ...item, isPopular: !item.isPopular } : item));
      alert('Không lưu được mẫu thông dụng.');
    } finally {
      setSavingTemplateId(null);
    }
  };

  const toggleFormula = async (designId: string, isActive: boolean) => {
    if (!activeSystemId) return;
    try {
      if (isActive) {
        setFormulas(prev => prev.filter(f => f.doorModelId !== designId));
      } else {
        setFormulas(prev => [...prev, { id: 'temp', aluSystemId: activeSystemId, doorModelId: designId }]);
      }

      await apiSend(`/system-formulas/systems/${activeSystemId}/formulas/toggle`, 'POST', {
        doorModelId: designId,
        active: !isActive
      });
      fetchFormulas(activeSystemId);
    } catch (err) {
      console.error(err);
      fetchFormulas(activeSystemId);
    }
  };

  const handleUploadClick = (designId: string) => {
    setPendingUploadId(designId);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingUploadId || !activeSystemId) return;

    try {
      setUploading(pendingUploadId);
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch(`${apiUrl}/system-formulas/systems/${activeSystemId}/formulas/${pendingUploadId}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        },
        body: formData
      });
      
      if (!res.ok) throw new Error('Upload failed');
      
      alert('Tải lên thành công!');
      fetchFormulas(activeSystemId);
    } catch (err) {
      console.error(err);
      alert('Lỗi tải lên!');
    } finally {
      setUploading(null);
      setPendingUploadId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageUploadClick = (designId: string) => {
    setPendingImageUploadId(designId);
    if (imageInputRef.current) {
      imageInputRef.current.click();
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingImageUploadId) return;

    try {
      setUploadingImage(pendingImageUploadId);
      const formData = new FormData();
      formData.append('image', file);
      
      const res = await fetch(`${apiUrl}/system-formulas/door-designs/${pendingImageUploadId}/image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        },
        body: formData
      });
      
      if (!res.ok) throw new Error('Upload image failed');
      
      alert('Tải ảnh thành công!');
      loadData();
    } catch (err) {
      console.error(err);
      alert('Lỗi tải ảnh!');
    } finally {
      setUploadingImage(null);
      setPendingImageUploadId(null);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const activeSystem = systems.find(s => s.id === activeSystemId);
  const groupedDesigns = useMemo(() => {
    const map = new Map<string, DoorDesign[]>();
    designs.forEach(d => {
      if (!map.has(d.type)) map.set(d.type, []);
      map.get(d.type)!.push(d);
    });
    return map;
  }, [designs]);

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: ui.text, margin: '0 0 8px' }}>
          Quản lý Công thức cắt (Eurohouse)
        </h1>
        <p style={{ color: ui.textMuted, margin: 0, fontSize: 15 }}>
          Chọn các mẫu cửa tương ứng với từng hệ nhôm, tải lên file excel cấu hình cắt và ảnh mẫu.
        </p>
      </div>

      <div style={{ background: ui.surface, border: `1px solid ${ui.border}`, borderRadius: 16, padding: 20, marginBottom: 28, boxShadow: ui.shadowLg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: ui.text, margin: '0 0 6px' }}>
              Mẫu cửa tham chiếu cho hệ Eurohouse
            </h2>
            <p style={{ color: ui.textMuted, margin: 0, fontSize: 14 }}>
              Hệ nhôm lấy theo catalog Eurohouse. Ảnh và công thức bên dưới là mẫu tạm từ phanmemcua để tick các mẫu thông dụng.
            </p>
          </div>
          <div style={{ borderRadius: 999, background: ui.brandSoft, color: ui.brandText, padding: '8px 12px', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>
            {referenceTemplates.filter((item) => item.isPopular).length}/{referenceTemplates.length} đã chọn
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '240px 260px minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
          <div style={{ border: `1px solid ${ui.border}`, borderRadius: 12, padding: 10, maxHeight: 520, overflow: 'auto' }}>
            <h3 style={{ fontSize: 13, color: ui.textMuted, fontWeight: 800, margin: '4px 6px 10px', textTransform: 'uppercase' }}>Phân hệ Eurohouse</h3>
            {referenceSystems.map((system) => (
              <button
                key={system.id}
                onClick={() => handleReferenceSystemClick(system.id)}
                style={{
                  width: '100%',
                  border: 0,
                  borderRadius: 8,
                  background: activeReferenceSystemId === system.id ? ui.brandSoft : 'transparent',
                  color: activeReferenceSystemId === system.id ? ui.brandText : ui.text,
                  padding: '10px 12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontWeight: activeReferenceSystemId === system.id ? 800 : 600,
                  marginBottom: 4
                }}
              >
                <span style={{ display: 'block', fontSize: 13 }}>{system.name}</span>
                <span style={{ display: 'block', fontSize: 11, color: ui.textMuted, marginTop: 2 }}>{system.code}</span>
              </button>
            ))}
          </div>

          <div style={{ border: `1px solid ${ui.border}`, borderRadius: 12, padding: 10, maxHeight: 520, overflow: 'auto' }}>
            <h3 style={{ fontSize: 13, color: ui.textMuted, fontWeight: 800, margin: '4px 6px 10px', textTransform: 'uppercase' }}>Loại cửa</h3>
            {templateTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => handleTemplateTypeClick(type)}
                style={{
                  width: '100%',
                  border: 0,
                  borderRadius: 8,
                  background: activeTemplateTypeId === type.id ? ui.brandSoft : 'transparent',
                  color: activeTemplateTypeId === type.id ? ui.brandText : ui.text,
                  padding: '10px 12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontWeight: activeTemplateTypeId === type.id ? 800 : 600,
                  marginBottom: 4
                }}
              >
                <span style={{ display: 'block', fontSize: 13 }}>{type.name}</span>
                <span style={{ display: 'block', fontSize: 11, color: ui.textMuted, marginTop: 2 }}>
                  {type.popularCount || 0} thông dụng / {type.templateCount} mẫu
                </span>
              </button>
            ))}
          </div>

          <div style={{ minHeight: 260 }}>
            {referenceLoading ? (
              <div style={{ height: 260, display: 'grid', placeItems: 'center', color: ui.textMuted }}>
                <Loader2 size={24} className="animate-spin" />
              </div>
            ) : referenceTemplates.length === 0 ? (
              <div style={{ height: 260, display: 'grid', placeItems: 'center', color: ui.textMuted, border: `1px dashed ${ui.border}`, borderRadius: 12 }}>
                Chưa có mẫu tham chiếu.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                {referenceTemplates.map((template) => {
                  const selected = !!template.isPopular;
                  return (
                    <button
                      key={template.templateId}
                      onClick={() => toggleTemplatePopular(template)}
                      disabled={savingTemplateId === template.templateId}
                      style={{
                        position: 'relative',
                        border: `2px solid ${selected ? ui.brand : ui.border}`,
                        borderRadius: 10,
                        background: ui.surface,
                        padding: 0,
                        overflow: 'hidden',
                        cursor: savingTemplateId === template.templateId ? 'wait' : 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ height: 132, background: ui.surfaceMuted, display: 'grid', placeItems: 'center', padding: 8 }}>
                        {template.imageUrl ? (
                          <img src={assetUrl(template.imageUrl)} alt={template.templateName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        ) : (
                          <span style={{ color: ui.textFaint, fontWeight: 700 }}>No image</span>
                        )}
                      </div>
                      <div style={{ padding: 10 }}>
                        <div style={{ color: ui.text, fontWeight: 800, fontSize: 13, lineHeight: 1.35, minHeight: 36 }}>{template.templateName}</div>
                        <div style={{ color: ui.textMuted, fontWeight: 600, fontSize: 11, marginTop: 5, lineHeight: 1.35 }}>{template.sourceSystemName || template.systemName}</div>
                      </div>
                      <span style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 30,
                        height: 30,
                        borderRadius: 999,
                        display: 'grid',
                        placeItems: 'center',
                        background: selected ? ui.brand : 'rgba(255,255,255,0.9)',
                        color: selected ? '#fff' : ui.textMuted,
                        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.12)'
                      }}>
                        {savingTemplateId === template.templateId ? <Loader2 size={15} className="animate-spin" /> : <Star size={15} fill={selected ? '#fff' : 'none'} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ width: 260, background: ui.surface, border: `1px solid ${ui.border}`, borderRadius: 16, padding: 12, position: 'sticky', top: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: ui.text, margin: '0 0 16px', padding: '0 8px' }}>
            HỆ NHÔM
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {systems.map(sys => (
              <button
                key={sys.id}
                onClick={() => handleSystemClick(sys.id)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: activeSystemId === sys.id ? ui.brandSoft : 'transparent',
                  color: activeSystemId === sys.id ? ui.brand : ui.textMuted,
                  fontWeight: activeSystemId === sys.id ? 700 : 500,
                  fontSize: 14,
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {sys.name}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: ui.textMuted }}>Đang tải...</div>
          ) : (
            <div>
              {Array.from(groupedDesigns.entries()).map(([type, desList]) => (
                <div key={type} style={{ marginBottom: 32 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: ui.text, marginBottom: 16, paddingBottom: 8, borderBottom: `2px solid ${ui.border}` }}>
                    {type}
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                    {desList.map(design => {
                      const formula = formulas.find(f => f.doorModelId === design.id);
                      const isActive = !!formula;
                      const hasExcel = !!formula?.excelFilePath;
                      
                      return (
                        <div key={design.id} style={{
                          background: ui.surface,
                          borderRadius: 16,
                          border: `1px solid ${isActive ? ui.brand : ui.border}`,
                          padding: 16,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                          position: 'relative',
                          boxShadow: isActive ? '0 4px 16px rgba(212, 175, 55, 0.1)' : 'none',
                          overflow: 'hidden'
                        }}>
                          {design.imageUrl ? (
                            <div style={{ width: '100%', height: 160, borderRadius: 8, overflow: 'hidden', background: '#f5f5f5', marginBottom: 4, position: 'relative' }}>
                              <img src={design.imageUrl.startsWith('http') ? design.imageUrl : `${apiUrl.replace('/api', '')}${design.imageUrl}`} alt={design.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <button
                                onClick={() => handleImageUploadClick(design.id)}
                                style={{
                                  position: 'absolute', top: 8, right: 8,
                                  background: 'rgba(255,255,255,0.8)',
                                  border: 'none', borderRadius: '50%',
                                  width: 32, height: 32,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                }}
                                title="Đổi ảnh"
                              >
                                {uploadingImage === design.id ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} color={ui.text} />}
                              </button>
                            </div>
                          ) : (
                            <div style={{ width: '100%', height: 160, borderRadius: 8, background: '#f5f5f5', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                              <button
                                onClick={() => handleImageUploadClick(design.id)}
                                style={{
                                  background: ui.brandSoft, border: `1px dashed ${ui.brand}`, borderRadius: 8,
                                  padding: '12px 16px', color: ui.brand, fontWeight: 600, fontSize: 13,
                                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'
                                }}
                              >
                                {uploadingImage === design.id ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                                Thêm ảnh mẫu
                              </button>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: ui.text }}>{design.name}</h3>
                            <button
                              onClick={() => toggleFormula(design.id, isActive)}
                              style={{
                                width: 24, height: 24, borderRadius: 6,
                                background: isActive ? ui.brand : 'transparent',
                                border: `1px solid ${isActive ? ui.brand : ui.border}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer',
                                flexShrink: 0,
                                marginLeft: 8
                              }}
                            >
                              {isActive && <Check size={14} color="#fff" strokeWidth={3} />}
                            </button>
                          </div>
                          
                          {isActive && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: ui.background, padding: '8px 12px', borderRadius: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: hasExcel ? '#10b981' : ui.textMuted, fontSize: 13, fontWeight: 500 }}>
                                <FileSpreadsheet size={16} />
                                {hasExcel ? 'Đã tải lên Excel' : 'Chưa có Excel'}
                              </div>
                              <button
                                onClick={() => handleUploadClick(design.id)}
                                disabled={uploading === design.id}
                                style={{
                                  background: 'transparent',
                                  border: `1px solid ${ui.border}`,
                                  borderRadius: 6,
                                  padding: '4px 8px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: ui.text,
                                  cursor: uploading === design.id ? 'not-allowed' : 'pointer'
                                }}
                              >
                                {uploading === design.id ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                                Tải lên
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept=".xlsx,.xls"
        onChange={handleFileChange}
      />
      <input 
        type="file" 
        ref={imageInputRef} 
        style={{ display: 'none' }} 
        accept="image/png, image/jpeg, image/webp"
        onChange={handleImageChange}
      />
    </div>
  );
}
