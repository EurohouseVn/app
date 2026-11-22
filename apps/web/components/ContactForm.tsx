'use client';

import { FormEvent, useState } from 'react';
import { CheckCircle2, LoaderCircle, Send } from 'lucide-react';

type State = 'idle' | 'sending' | 'success' | 'error';

export function ContactForm({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('sending');
    setMessage('');
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.nhomeurohouse.com/api';
      const response = await fetch(`${baseUrl}/public/website/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('request_failed');
      form.reset();
      setState('success');
      setMessage('Eurohouse đã nhận yêu cầu. Bộ phận phụ trách sẽ liên hệ lại sớm.');
    } catch {
      setState('error');
      setMessage('Chưa gửi được yêu cầu. Vui lòng gọi 0221 3900 899 hoặc thử lại sau.');
    }
  }

  if (state === 'success') {
    return (
      <div className="form-success" role="status">
        <CheckCircle2 size={30} />
        <strong>Đã gửi yêu cầu</strong>
        <p>{message}</p>
        <button className="button button-secondary" type="button" onClick={() => setState('idle')}>Gửi yêu cầu khác</button>
      </div>
    );
  }

  return (
    <form className={compact ? 'lead-form compact' : 'lead-form'} onSubmit={submit}>
      <div className="form-grid">
        <label>
          Họ và tên <span>*</span>
          <input name="name" required minLength={2} maxLength={100} autoComplete="name" placeholder="Nguyễn Văn An" />
        </label>
        <label>
          Số điện thoại <span>*</span>
          <input name="phone" required minLength={8} maxLength={20} inputMode="tel" autoComplete="tel" placeholder="09xx xxx xxx" />
        </label>
        <label>
          Email
          <input name="email" type="email" maxLength={120} autoComplete="email" placeholder="email@congty.vn" />
        </label>
        <label>
          Nhu cầu
          <select name="interest" defaultValue="Tư vấn sản phẩm">
            <option>Tư vấn sản phẩm</option>
            <option>Nhận catalog kỹ thuật</option>
            <option>Đùn nhôm theo bản vẽ</option>
            <option>Trở thành NPP / Đại lý</option>
            <option>Hỗ trợ ứng dụng</option>
          </select>
        </label>
      </div>
      {!compact && (
        <label>
          Khu vực / Địa chỉ
          <input name="address" maxLength={180} autoComplete="street-address" placeholder="Tỉnh, thành phố hoặc địa chỉ công trình" />
        </label>
      )}
      <label>
        Nội dung cần tư vấn
        <textarea name="message" maxLength={1000} rows={compact ? 3 : 5} placeholder="Mô tả hệ nhôm, quy mô hoặc yêu cầu kỹ thuật của anh/chị" />
      </label>
      <input className="honeypot" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <button className="button button-primary" type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}
        {state === 'sending' ? 'Đang gửi...' : 'Gửi yêu cầu tư vấn'}
      </button>
      {state === 'error' && <p className="form-error" role="alert">{message}</p>}
      <p className="form-note">Thông tin chỉ được dùng để Eurohouse liên hệ và hỗ trợ yêu cầu này.</p>
    </form>
  );
}
