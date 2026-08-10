'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiDelete } from '../../src/lib/api';
import { Search, Trash2, CheckCircle2 } from 'lucide-react';
import { pageTitleStyle, eyebrowStyle, glassPanelStyle, ui } from '../../src/ui';
import type { DoorModel } from '@eurohouse/types';
import Image from 'next/image';

export default function DoorModelsFilterPage() {
  const [doors, setDoors] = useState<DoorModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadDoors();
  }, []);

  const loadDoors = async () => {
    try {
      setLoading(true);
      const data = await apiGet<DoorModel[]>('/system-formulas/door-designs');
      setDoors(data);
    } catch (e) {
      console.error(e);
      alert('Lỗi tải danh sách cửa');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredDoors.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDoors.map(d => d.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`Bạn có chắc muốn xoá ${selectedIds.size} mẫu cửa đã chọn? Các công thức liên quan cũng sẽ bị ảnh hưởng.`)) return;
    try {
      await apiDelete('/system-formulas/door-designs', { ids: Array.from(selectedIds) });
      alert('Đã xoá thành công');
      setSelectedIds(new Set());
      loadDoors();
    } catch (e) {
      console.error(e);
      alert('Lỗi khi xoá');
    }
  };

  const filteredDoors = doors.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase()) || 
    d.type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <p style={eyebrowStyle}>KHO MẪU CỬA</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={pageTitleStyle}>Lọc Dữ Liệu Cửa</h1>
        <div style={{ display: 'flex', gap: 12 }}>
          {selectedIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              style={{
                background: ui.danger, color: '#fff', border: 'none', padding: '10px 20px',
                borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                fontWeight: 600
              }}
            >
              <Trash2 size={18} />
              Xoá {selectedIds.size} mẫu chọn
            </button>
          )}
        </div>
      </div>

      <div style={{ ...glassPanelStyle, marginTop: 24, padding: 24 }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search style={{ position: 'absolute', left: 16, top: 12, color: ui.textMuted }} size={20} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm kiếm theo tên mẫu cửa hoặc loại cửa..."
              style={{
                width: '100%', padding: '12px 16px 12px 48px', borderRadius: 8,
                border: `1px solid ${ui.border}`, background: ui.surface, color: ui.text
              }}
            />
          </div>
          <button
            onClick={selectAll}
            style={{
              background: ui.surface, border: `1px solid ${ui.border}`, color: ui.text,
              padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600
            }}
          >
            {selectedIds.size === filteredDoors.length && filteredDoors.length > 0 ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
          </button>
        </div>

        {loading ? (
          <p>Đang tải dữ liệu...</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            {filteredDoors.map(door => {
              const isSelected = selectedIds.has(door.id);
              return (
                <div
                  key={door.id}
                  onClick={() => toggleSelect(door.id)}
                  style={{
                    border: `2px solid ${isSelected ? ui.brand : ui.border}`,
                    borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
                    position: 'relative', background: ui.surface
                  }}
                >
                  {isSelected && (
                    <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
                      <CheckCircle2 color={ui.brand} fill="#fff" size={24} />
                    </div>
                  )}
                  <div style={{ width: '100%', height: 180, position: 'relative', background: ui.surfaceMuted }}>
                    {door.imageUrl ? (
                      <img
                        src={`${process.env.NEXT_PUBLIC_API_URL}${door.imageUrl}`}
                        alt={door.name}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ui.textFaint }}>
                        No Image
                      </div>
                    )}
                  </div>
                  <div style={{ padding: 12 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: ui.text }} title={door.name}>
                      {door.name.length > 30 ? door.name.substring(0, 30) + '...' : door.name}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: ui.textMuted }}>{door.type}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
