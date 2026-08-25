'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, HandCoins, Package, TrendingUp, Warehouse, X } from 'lucide-react';
import type { NppDashboardData } from '@eurohouse/types';
import { NppPage } from '../src/NppPage';
import type { Promotion } from '@eurohouse/types';
import { apiGet, assetUrl } from '../src/lib/api';
import { currency, eyebrowStyle, pageTitleStyle, panelStyle, subtitleStyle, ui } from '../src/ui';

const statusLabel: Record<string, string> = {
  NEW: 'Mới',
  NPP_REVIEWING: 'Đã tiếp nhận',
  CONFIRMED: 'Đã xác nhận',
  RESERVED: 'Đã giữ hàng',
  PICKING: 'Đang soạn hàng',
  SHIPPED: 'Đã tạo đơn giao',
  PARTIALLY_SHIPPED: 'Giao một phần',
  DELIVERED: 'Đã giao hàng',
  ADMIN_SENT_NPP: 'Công ty đã giao NPP',
  NPP_RECEIVED: 'Đã nhận đủ từ công ty',
  RECEIVED_BY_NPP: 'Đã tiếp nhận',
  SENT_TO_ADMIN: 'Đã gửi công ty',
  PROCESSING: 'Đang xử lý',
  PARTIAL: 'Giao một phần',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};

export default function NppHome() {
  const [data, setData] = useState<NppDashboardData | null>(null);
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [promoIndex, setPromoIndex] = useState(0);
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<NppDashboardData>('/npp/dashboard')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Không tải được dashboard.'));
      
    apiGet<Promotion[]>('/content/promotions?audience=NPP_DEALER')
      .then((items) => {
        setPromos(items);
        setPromoIndex(0);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (promos.length <= 1) return undefined;
    const timer = window.setInterval(() => setPromoIndex((cur) => (cur + 1) % promos.length), 5000);
    return () => window.clearInterval(timer);
  }, [promos.length]);

  const totalOrders = data ? Object.values(data.ordersByStatus).reduce((s, v) => s + v, 0) : 0;
  const activePromo = promos[promoIndex] ?? null;
  const modalImages = useMemo(() => {
    if (!selectedPromo) return [];
    const gallery = Array.isArray(selectedPromo.gallery) && selectedPromo.gallery.length > 0 ? selectedPromo.gallery : [];
    return gallery.length ? gallery : selectedPromo.imageUrl ? [selectedPromo.imageUrl] : [];
  }, [selectedPromo]);

  function openPromo(promo: Promotion) {
    setSelectedPromo(promo);
    setSelectedImageIndex(0);
  }

  function changeModalImage(delta: number) {
    if (modalImages.length === 0) return;
    setSelectedImageIndex((cur) => (cur + delta + modalImages.length) % modalImages.length);
  }

  return (
    <NppPage>
      <p style={eyebrowStyle}>DASHBOARD</p>
      <h1 style={pageTitleStyle}>Tổng quan NPP</h1>
      <p style={subtitleStyle}>Số liệu vận hành: đơn hàng, xưởng quản lý, công nợ và doanh thu tháng này.</p>
      {error ? <p style={{ color: ui.danger, fontWeight: 700 }}>{error}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginTop: 20 }}>
        <div style={{ ...panelStyle, padding: 20 }}>
          <Package size={20} color={ui.brand} />
          <p style={{ margin: '14px 0 2px', color: ui.textMuted, fontWeight: 600, fontSize: 13 }}>Tổng đơn hàng</p>
          <strong style={{ display: 'block', fontSize: 26, color: ui.text }}>{totalOrders}</strong>
        </div>
        <div style={{ ...panelStyle, padding: 20 }}>
          <Warehouse size={20} color={ui.teal} />
          <p style={{ margin: '14px 0 2px', color: ui.textMuted, fontWeight: 600, fontSize: 13 }}>Xưởng quản lý</p>
          <strong style={{ display: 'block', fontSize: 26, color: ui.text }}>{data?.managedFactoryCount ?? 0}</strong>
        </div>
        <div style={{ ...panelStyle, padding: 20 }}>
          <HandCoins size={20} color={ui.danger} />
          <p style={{ margin: '14px 0 2px', color: ui.textMuted, fontWeight: 600, fontSize: 13 }}>Công nợ còn mở</p>
          <strong style={{ display: 'block', fontSize: 26, color: ui.text }}>{currency((data?.openDebtTotal ?? 0) - (data?.openDebtPaid ?? 0))}</strong>
        </div>
        <div style={{ ...panelStyle, padding: 20 }}>
          <TrendingUp size={20} color={ui.success} />
          <p style={{ margin: '14px 0 2px', color: ui.textMuted, fontWeight: 600, fontSize: 13 }}>Doanh thu tháng này</p>
          <strong style={{ display: 'block', fontSize: 26, color: ui.text }}>{currency(data?.monthRevenue ?? 0)}</strong>
        </div>
      </div>

      <div style={{ ...panelStyle, marginTop: 20 }}>
        <h2 style={{ color: ui.text, fontSize: 17, fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={16} color={ui.textMuted} /> Đơn hàng theo trạng thái
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {Object.entries(data?.ordersByStatus ?? {}).map(([status, count]) => (
            <div key={status} style={{ border: `1px solid ${ui.border}`, borderRadius: 12, padding: '12px 18px', minWidth: 140 }}>
              <p style={{ margin: 0, color: ui.textMuted, fontSize: 12, fontWeight: 600 }}>{statusLabel[status] ?? status}</p>
              <strong style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 20, color: ui.text, marginTop: 4 }}>
                <CheckCircle2 size={15} color={ui.brand} /> {count}
              </strong>
            </div>
          ))}
          {Object.keys(data?.ordersByStatus ?? {}).length === 0 ? (
            <p style={{ color: ui.textFaint }}>Chưa có đơn hàng nào.</p>
          ) : null}
        </div>
      </div>
      
      <div style={{ ...panelStyle, marginTop: 20 }}>
        <h2 style={{ color: ui.brand, fontSize: 17, fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={16} color={ui.brand} /> New Info - Chương trình Khuyến Mãi
        </h2>
        {promos.length === 0 ? (
          <p style={{ color: ui.textMuted }}>Hiện tại chưa có chương trình khuyến mãi nào.</p>
        ) : (
          <>
            {activePromo ? (
              <button
                type="button"
                onClick={() => openPromo(activePromo)}
                style={{ width: '100%', border: 0, padding: 0, cursor: 'pointer', background: ui.surface, borderRadius: 12, overflow: 'hidden', textAlign: 'left', marginBottom: 16 }}
              >
                {activePromo.imageUrl ? (
                  <img src={assetUrl(activePromo.imageUrl)} alt={activePromo.title} style={{ width: '100%', height: 230, objectFit: 'cover', display: 'block', backgroundColor: ui.surfaceMuted }} />
                ) : null}
                <div style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, color: ui.text, fontWeight: 800 }}>{activePromo.title}</h3>
                    {activePromo.description ? <p style={{ margin: '4px 0 0', fontSize: 13, color: ui.textMuted }}>{activePromo.description}</p> : null}
                  </div>
                  {promos.length > 1 ? <span style={{ color: ui.textMuted, fontSize: 12, fontWeight: 700 }}>{promoIndex + 1}/{promos.length}</span> : null}
                </div>
              </button>
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
              {promos.map(promo => (
              <div key={promo.id} style={{ border: `1px solid ${ui.border}`, borderRadius: 12, padding: 16, display: 'flex', gap: 16 }}>
                {promo.imageUrl && (
                  <button type="button" onClick={() => openPromo(promo)} style={{ border: 0, padding: 0, background: 'transparent', cursor: 'pointer' }}>
                    <img src={assetUrl(promo.imageUrl)} alt={promo.title} style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, backgroundColor: ui.surface }} />
                  </button>
                )}
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 6px', fontSize: 15, color: ui.text, fontWeight: 700 }}>{promo.title}</h3>
                  {promo.description && <p style={{ margin: 0, fontSize: 13, color: ui.textMuted, lineHeight: 1.5 }}>{promo.description}</p>}
                </div>
              </div>
              ))}
            </div>
          </>
        )}
      </div>
      {selectedPromo && modalImages.length > 0 ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.86)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <button type="button" onClick={() => setSelectedPromo(null)} aria-label="Đóng" style={{ position: 'absolute', top: 18, right: 18, width: 44, height: 44, borderRadius: 999, border: 0, background: 'rgba(255,255,255,0.16)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <X size={22} />
          </button>
          <button type="button" onClick={() => changeModalImage(-1)} aria-label="Ảnh trước" style={{ width: 48, height: 48, borderRadius: 999, border: 0, background: 'rgba(255,255,255,0.16)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <ChevronLeft size={24} />
          </button>
          <img src={assetUrl(modalImages[selectedImageIndex])} alt={selectedPromo.title} style={{ maxWidth: '82vw', maxHeight: '88vh', objectFit: 'contain', margin: '0 18px' }} />
          <button type="button" onClick={() => changeModalImage(1)} aria-label="Ảnh sau" style={{ width: 48, height: 48, borderRadius: 999, border: 0, background: 'rgba(255,255,255,0.16)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <ChevronRight size={24} />
          </button>
        </div>
      ) : null}
    </NppPage>
  );
}
