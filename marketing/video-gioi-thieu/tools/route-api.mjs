// Máy chủ dev web NPP dùng chung thư mục .next với bản dev khác nên có thể gọi API cổng 3001; ép mọi lệnh gọi đó về API tạm 3061 khi quay.
export async function rewriteApi(ctx) {
  await ctx.route(/^http:\/\/(localhost|127\.0\.0\.1):3001\/.*/, (route) => route.continue({ url: route.request().url().replace(/^http:\/\/(localhost|127\.0\.0\.1):3001/, 'http://127.0.0.1:3061') }));
}
