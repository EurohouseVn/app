import QRCode from 'qrcode';
import { storeLinks, type StoreLink } from '@/lib/store-links';
import './app-download.css';

function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="currentColor">
      <path d="M16.37 12.6c-.03-2.5 2.04-3.7 2.13-3.76-1.16-1.7-2.97-1.93-3.61-1.96-1.54-.16-3 .9-3.78.9-.78 0-1.98-.88-3.25-.85-1.67.03-3.21.97-4.07 2.46-1.74 3.01-.44 7.47 1.25 9.91.83 1.2 1.82 2.54 3.12 2.49 1.25-.05 1.72-.8 3.23-.8 1.51 0 1.93.8 3.25.78 1.34-.03 2.2-1.22 3.02-2.42.95-1.39 1.34-2.74 1.37-2.81-.03-.01-2.63-1.01-2.66-4.01zM13.9 5.2c.69-.84 1.16-2 1.03-3.16-1 .04-2.2.67-2.92 1.5-.64.74-1.2 1.92-1.05 3.05 1.11.09 2.24-.56 2.94-1.39z" />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path fill="#00d2ff" d="M3.6 2.3c-.2.2-.3.6-.3 1v17.4c0 .4.1.8.3 1l9.8-9.7z" />
      <path fill="#ffce00" d="M16.7 15.3l-3.3-3.3 3.3-3.3 3.9 2.2c1.1.6 1.1 1.6 0 2.2z" />
      <path fill="#f43d56" d="M16.7 15.3L13.4 12 3.6 21.7c.4.4 1 .4 1.7.1z" />
      <path fill="#00e57a" d="M16.7 8.7L5.3 2.2c-.7-.4-1.3-.3-1.7.1l9.8 9.7z" />
    </svg>
  );
}

async function qrSvg(href: string): Promise<string> {
  return QRCode.toString(href, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#151a22', light: '#ffffff' } });
}

async function StoreCard({ store }: { store: StoreLink }) {
  const svg = store.live ? await qrSvg(store.href) : null;
  const Glyph = store.id === 'ios' ? AppleGlyph : PlayGlyph;
  const label = `${store.action} ${store.name}`;
  return (
    <article className="app-dl-card" data-store={store.id}>
      {svg ? (
        <div className="app-dl-qr" role="img" aria-label={`Mã QR tải ứng dụng Eurohouse trên ${store.name}`} dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="app-dl-qr app-dl-qr--soon" role="img" aria-label={`Mã QR ${store.name} sẽ có khi ứng dụng được duyệt`}>
          <span>Sắp có</span>
        </div>
      )}
      {store.live ? (
        <a className="app-dl-badge" href={store.href} rel="noopener" aria-label={label}>
          <Glyph />
          <span><small>{store.action}</small><strong>{store.name}</strong></span>
        </a>
      ) : (
        <span className="app-dl-badge app-dl-badge--soon" aria-label={`${store.name}: sắp ra mắt`}>
          <Glyph />
          <span><small>Sắp có trên</small><strong>{store.name}</strong></span>
        </span>
      )}
      <p>{store.live ? `Quét bằng camera điện thoại để mở ${store.name}.` : 'Đang chờ Google duyệt, sẽ mở ngay khi có.'}</p>
    </article>
  );
}

export async function AppDownload() {
  return (
    <section className="section app-dl" id="tai-ung-dung" aria-labelledby="app-dl-heading">
      <div className="container">
        <div className="section-heading">
          <p className="kicker">Ứng dụng Eurohouse</p>
          <h2 id="app-dl-heading">Tải ứng dụng cho xưởng nhôm kính</h2>
          <p>Quét mã bằng camera điện thoại, hoặc bấm nút của cửa hàng ứng dụng bạn dùng.</p>
        </div>
        <div className="app-dl-grid">
          {storeLinks.map((store) => <StoreCard key={store.id} store={store} />)}
        </div>
      </div>
    </section>
  );
}
