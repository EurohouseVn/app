/**
 * Thu nhỏ ảnh phiếu trước khi gửi: ảnh chụp điện thoại có thể vài MB, mà đọc chữ chỉ cần cạnh dài khoảng 1600 px.
 * Ảnh nhỏ gửi nhanh hơn trên mạng yếu và đọc chữ không kém đi.
 */
export function scaleToFit(width: number, height: number, maxSide: number): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) throw new Error('Kích thước ảnh không hợp lệ.');
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width: Math.round(width), height: Math.round(height) };
  const ratio = maxSide / longest;
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

export async function fileToJpegBase64(file: File, maxSide = 1600, quality = 0.82): Promise<{ base64: string; mime: 'image/jpeg'; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = scaleToFit(bitmap.width, bitmap.height, maxSide);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Trình duyệt không xử lý được ảnh.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    return { base64: dataUrl.slice(dataUrl.indexOf(',') + 1), mime: 'image/jpeg', width, height };
  } finally {
    bitmap.close();
  }
}
