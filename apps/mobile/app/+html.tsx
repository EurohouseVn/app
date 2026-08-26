import type { ReactNode } from 'react';

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <title>Eurohouse CSSX</title>
        <meta name="description" content="Ứng dụng đặt hàng và quản lý công trình dành cho cơ sở sản xuất Eurohouse." />
        <meta name="theme-color" content="#F47C20" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Eurohouse" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <style dangerouslySetInnerHTML={{ __html: 'html,body,#root{width:100%;height:100%;margin:0}body{overflow:hidden}' }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
