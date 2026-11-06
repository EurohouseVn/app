import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as exceljs from 'exceljs';
import { imageSize } from 'image-size';
import { spawnSync } from 'child_process';
import * as os from 'os';

const ffprobeStatic = require('ffprobe-static') as { path: string };

export type UploadedFileLike = {
  buffer?: Buffer;
  path?: string;
  originalname?: string;
  mimetype?: string;
  size?: number;
};

export const IMAGE_UPLOAD_OPTIONS = { limits: { fileSize: 8 * 1024 * 1024 } };
export const XLSX_UPLOAD_OPTIONS = { limits: { fileSize: 12 * 1024 * 1024 } };
export const PDF_UPLOAD_OPTIONS = { limits: { fileSize: 30 * 1024 * 1024 } };
export const WEBSITE_MEDIA_UPLOAD_OPTIONS = { limits: { fileSize: 250 * 1024 * 1024 } };

export type WebsiteUploadInspection = {
  mediaType: 'IMAGE' | 'VIDEO';
  mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'video/mp4' | 'video/webm';
  extension: '.jpg' | '.png' | '.webp' | '.mp4' | '.webm';
  width?: number;
  height?: number;
  durationSeconds?: number;
};

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

const WEBSITE_MEDIA: Record<string, { extension: WebsiteUploadInspection['extension']; mediaType: WebsiteUploadInspection['mediaType']; max: number }> = {
  'image/jpeg': { extension: '.jpg', mediaType: 'IMAGE', max: 8 * 1024 * 1024 },
  'image/png': { extension: '.png', mediaType: 'IMAGE', max: 8 * 1024 * 1024 },
  'image/webp': { extension: '.webp', mediaType: 'IMAGE', max: 8 * 1024 * 1024 },
  'video/mp4': { extension: '.mp4', mediaType: 'VIDEO', max: 250 * 1024 * 1024 },
  'video/webm': { extension: '.webm', mediaType: 'VIDEO', max: 250 * 1024 * 1024 },
};

function jpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1]!;
    const length = buffer.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

function webpDimensions(buffer: Buffer): { width: number; height: number } | null {
  const chunk = buffer.subarray(12, 16).toString('ascii');
  if (chunk === 'VP8X' && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }
  return null;
}

export function assertWebsiteMediaUpload(file: UploadedFileLike): WebsiteUploadInspection {
  const mime = String(file.mimetype ?? '').toLowerCase();
  const rule = WEBSITE_MEDIA[mime];
  if (!rule) throw new BadRequestException('Chỉ chấp nhận JPG, PNG, WebP, MP4 hoặc WebM.');
  const extension = path.extname(file.originalname ?? '').toLowerCase();
  const acceptedExtension = extension === rule.extension || (mime === 'image/jpeg' && extension === '.jpeg');
  if (!acceptedExtension) throw new BadRequestException('Phần mở rộng và loại nội dung tải lên không khớp.');
  const buffer = file.buffer;
  if (!buffer?.length) throw new BadRequestException('Không đọc được nội dung file tải lên.');
  const size = file.size ?? buffer.byteLength;
  if (size > rule.max) {
    throw new BadRequestException(rule.mediaType === 'IMAGE' ? 'Ảnh không được vượt quá 8 MiB.' : 'Video không được vượt quá 250 MiB.');
  }

  let dimensions: { width: number; height: number } | null = null;
  if (mime === 'image/png') {
    if (buffer.length < 24 || !buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      throw new BadRequestException('Ảnh PNG có chữ ký không hợp lệ.');
    }
    dimensions = { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  } else if (mime === 'image/jpeg') {
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
      throw new BadRequestException('Ảnh JPEG có chữ ký không hợp lệ.');
    }
    dimensions = jpegDimensions(buffer);
  } else if (mime === 'image/webp') {
    if (buffer.length < 16 || buffer.subarray(0, 4).toString('ascii') !== 'RIFF' || buffer.subarray(8, 12).toString('ascii') !== 'WEBP') {
      throw new BadRequestException('Ảnh WebP có chữ ký không hợp lệ.');
    }
    dimensions = webpDimensions(buffer);
  } else if (mime === 'video/mp4') {
    if (buffer.length < 12 || buffer.subarray(4, 8).toString('ascii') !== 'ftyp') {
      throw new BadRequestException('Video MP4 có chữ ký không hợp lệ hoặc không khớp định dạng.');
    }
  } else if (buffer.length < 4 || !buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    throw new BadRequestException('Video WebM có chữ ký không hợp lệ hoặc không khớp định dạng.');
  }

  if (rule.mediaType === 'IMAGE') {
    try {
      const measured = imageSize(buffer);
      dimensions = measured.width && measured.height ? { width: measured.width, height: measured.height } : null;
    } catch {
      throw new BadRequestException('Không đọc được kích thước ảnh hoặc ảnh đã hỏng.');
    }
  }

  if (rule.mediaType === 'IMAGE' && (!dimensions || dimensions.width <= 0 || dimensions.height <= 0)) {
    throw new BadRequestException('Không đọc được kích thước ảnh hoặc kích thước bằng 0.');
  }
  let videoMetadata: Pick<WebsiteUploadInspection, 'width' | 'height' | 'durationSeconds'> = {};
  if (rule.mediaType === 'VIDEO' && buffer.length > 256) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'eurohouse-media-'));
    const temporaryFile = path.join(directory, `probe${rule.extension}`);
    try {
      fs.writeFileSync(temporaryFile, buffer);
      const probe = spawnSync(ffprobeStatic.path, [
        '-v', 'error', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', temporaryFile,
      ], { encoding: 'utf8', timeout: 30_000, windowsHide: true });
      if (probe.status !== 0) throw new Error(probe.stderr || 'ffprobe failed');
      const parsed = JSON.parse(probe.stdout) as { streams?: Array<{ width?: number; height?: number }>; format?: { duration?: string } };
      const stream = parsed.streams?.find((item) => item.width && item.height);
      const durationSeconds = Number(parsed.format?.duration);
      if (!stream?.width || !stream.height || !Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new Error('missing video metadata');
      videoMetadata = { width: stream.width, height: stream.height, durationSeconds };
    } catch {
      throw new BadRequestException('Không đọc được kích thước hoặc thời lượng video.');
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
  return { mediaType: rule.mediaType, mime: mime as WebsiteUploadInspection['mime'], extension: rule.extension, ...(dimensions ?? {}), ...videoMetadata };
}

export function imageExtension(file: UploadedFileLike) {
  const extension = IMAGE_EXTENSIONS[String(file?.mimetype || '').toLowerCase()];
  if (!extension) throw new BadRequestException('Chỉ chấp nhận ảnh PNG, JPEG hoặc WebP.');
  return extension;
}

export function pdfExtension(file: UploadedFileLike, buffer: Buffer) {
  const extension = path.extname(file?.originalname || '').toLowerCase();
  const mime = String(file?.mimetype || '').toLowerCase();
  if (extension !== '.pdf' || mime !== 'application/pdf') {
    throw new BadRequestException('Chỉ chấp nhận file PDF.');
  }
  if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new BadRequestException('File PDF không hợp lệ hoặc đã bị đổi phần mở rộng.');
  }
  return '.pdf';
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

export async function uploadedFileBuffer(file: UploadedFileLike): Promise<Buffer> {
  if (file.buffer) return file.buffer;
  if (file.path && fs.existsSync(file.path)) {
    const buffer = await fs.promises.readFile(file.path);
    await fs.promises.rm(file.path, { force: true });
    return buffer;
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
