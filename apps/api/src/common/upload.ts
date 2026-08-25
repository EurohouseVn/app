import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as exceljs from 'exceljs';

type UploadedFileLike = {
  buffer?: Buffer;
  path?: string;
  originalname?: string;
  mimetype?: string;
  size?: number;
};

export const IMAGE_UPLOAD_OPTIONS = { limits: { fileSize: 8 * 1024 * 1024 } };
export const XLSX_UPLOAD_OPTIONS = { limits: { fileSize: 12 * 1024 * 1024 } };

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

export function imageExtension(file: UploadedFileLike) {
  const extension = IMAGE_EXTENSIONS[String(file?.mimetype || '').toLowerCase()];
  if (!extension) throw new BadRequestException('Chỉ chấp nhận ảnh PNG, JPEG hoặc WebP.');
  return extension;
}

export function assertXlsx(file: UploadedFileLike) {
  const extension = path.extname(file?.originalname || '').toLowerCase();
  if (extension !== '.xlsx') throw new BadRequestException('Chỉ chấp nhận file công thức Excel .xlsx.');
}

export function persistUploadedFile(file: UploadedFileLike, targetPath: string) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  if (file.buffer) {
    fs.writeFileSync(targetPath, file.buffer);
    return;
  }
  if (file.path && fs.existsSync(file.path)) {
    fs.copyFileSync(file.path, targetPath);
    fs.unlinkSync(file.path);
    return;
  }
  throw new BadRequestException('Không đọc được nội dung file tải lên.');
}

export async function persistValidatedXlsx(file: UploadedFileLike, targetPath: string) {
  assertXlsx(file);
  const temporaryPath = `${targetPath}.upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  persistUploadedFile(file, temporaryPath);
  try {
    const workbook = new exceljs.Workbook();
    await workbook.xlsx.readFile(temporaryPath);
    if (workbook.worksheets.length === 0) throw new Error('Workbook has no worksheet');
    fs.copyFileSync(temporaryPath, targetPath);
  } catch {
    throw new BadRequestException('File Excel không hợp lệ hoặc không đọc được nội dung công thức.');
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
}
