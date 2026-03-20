import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BadRequestException } from '@nestjs/common';
import { UploadService } from './upload.service';

jest.mock('uuid', () => ({
  v4: () => 'mock-uuid',
}));

describe('UploadService', () => {
  let service: UploadService;
  let uploadRoot: string;

  beforeEach(() => {
    uploadRoot = path.join(os.tmpdir(), `upload-test-${Date.now()}-${Math.random()}`);
    const configService = {
      get: jest.fn().mockReturnValue(uploadRoot),
    } as any;
    service = new UploadService(configService);
  });

  afterEach(() => {
    if (fs.existsSync(uploadRoot)) {
      fs.rmSync(uploadRoot, { recursive: true, force: true });
    }
  });

  const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]);

  it('should reject invalid category', async () => {
    await expect(
      service.saveFile(
        {
          mimetype: 'application/pdf',
          originalname: 'a.pdf',
          size: pdfBuffer.length,
          buffer: pdfBuffer,
        } as any,
        'unknown',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject unsupported mime type', async () => {
    await expect(
      service.saveFile(
        {
          mimetype: 'text/plain',
          originalname: 'a.txt',
          size: 4,
          buffer: Buffer.from('test'),
        } as any,
        'temp',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject extension mismatch', async () => {
    await expect(
      service.saveFile(
        {
          mimetype: 'application/pdf',
          originalname: 'a.png',
          size: pdfBuffer.length,
          buffer: pdfBuffer,
        } as any,
        'temp',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject oversized file', async () => {
    await expect(
      service.saveFile(
        {
          mimetype: 'application/pdf',
          originalname: 'a.pdf',
          size: 100 * 1024 * 1024 + 1,
          buffer: pdfBuffer,
        } as any,
        'temp',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject invalid magic number', async () => {
    await expect(
      service.saveFile(
        {
          mimetype: 'application/pdf',
          originalname: 'a.pdf',
          size: 4,
          buffer: Buffer.from([0x00, 0x11, 0x22, 0x33]),
        } as any,
        'temp',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should save valid file and return metadata', async () => {
    const result = await service.saveFile(
      {
        mimetype: 'application/pdf',
        originalname: 'contract.pdf',
        size: pdfBuffer.length,
        buffer: pdfBuffer,
      } as any,
      'contracts',
    );

    expect(result.filename).toBe('mock-uuid.pdf');
    expect(result.url).toBe('/uploads/contracts/mock-uuid.pdf');
    expect(fs.existsSync(path.join(uploadRoot, 'contracts', 'mock-uuid.pdf'))).toBe(true);
  });

  it('should normalize mojibake original filename to readable utf-8', async () => {
    const readableName = '测试合同.pdf';
    const mojibakeName = Buffer.from(readableName, 'utf8').toString('latin1');

    const result = await service.saveFile(
      {
        mimetype: 'application/pdf',
        originalname: mojibakeName,
        size: pdfBuffer.length,
        buffer: pdfBuffer,
      } as any,
      'contracts',
    );

    expect(result.originalName).toBe(readableName);
    expect(result.filename).toBe('mock-uuid.pdf');
  });

  it('should use default temp category when saveFile category is omitted', async () => {
    const result = await service.saveFile({
      mimetype: 'application/pdf',
      originalname: 'default.pdf',
      size: pdfBuffer.length,
      buffer: pdfBuffer,
    } as any);

    expect(result.url).toBe('/uploads/temp/mock-uuid.pdf');
    expect(fs.existsSync(path.join(uploadRoot, 'temp', 'mock-uuid.pdf'))).toBe(true);
  });

  it('should delete existing file by url', async () => {
    const target = path.join(uploadRoot, 'temp', 'to-delete.pdf');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, pdfBuffer);

    await service.deleteFile('/uploads/temp/to-delete.pdf');

    expect(fs.existsSync(target)).toBe(false);
  });

  it('should reject saveFile when resolved path escapes upload dir', async () => {
    const sanitizeSpy = jest.spyOn(service as any, 'sanitizePath').mockReturnValue('../evil');

    await expect(
      service.saveFile(
        {
          mimetype: 'application/pdf',
          originalname: 'escape.pdf',
          size: pdfBuffer.length,
          buffer: pdfBuffer,
        } as any,
        'temp',
      ),
    ).rejects.toThrow(BadRequestException);

    sanitizeSpy.mockRestore();
  });

  it('should return without error when deleteFile receives empty url', async () => {
    await expect(service.deleteFile('')).resolves.toBeUndefined();
  });

  it('should reject deleteFile when resolved path escapes upload dir', async () => {
    const sanitizeSpy = jest.spyOn(service as any, 'sanitizePath').mockReturnValue('../evil');

    await expect(service.deleteFile('/uploads/temp/escape.pdf')).rejects.toThrow(BadRequestException);

    sanitizeSpy.mockRestore();
  });

  it('should return normalized file path in getFilePath', () => {
    const fullPath = service.getFilePath('/uploads/contracts/a.pdf');
    expect(fullPath).toBe(path.join(uploadRoot, 'contracts/a.pdf'));
  });

  it('should reject getFilePath when resolved path escapes upload dir', () => {
    const sanitizeSpy = jest.spyOn(service as any, 'sanitizePath').mockReturnValue('../evil');

    expect(() => service.getFilePath('/uploads/contracts/a.pdf')).toThrow(BadRequestException);

    sanitizeSpy.mockRestore();
  });

  it('should return false for unknown mime in private validators', () => {
    expect((service as any).validateFileMagicNumber(Buffer.from([0x01, 0x02]), 'application/x-unknown')).toBe(
      false,
    );
    expect((service as any).validateFileExtension('a.unknown', 'application/x-unknown')).toBe(false);
  });

  it('should fallback upload dir to \"uploads\" when config is empty', () => {
    const fallbackService = new UploadService({
      get: jest.fn().mockReturnValue(undefined),
    } as any);

    expect((fallbackService as any).uploadDir).toBe('uploads');
    const fallbackRoot = path.resolve('uploads');
    if (fs.existsSync(fallbackRoot)) {
      fs.rmSync(fallbackRoot, { recursive: true, force: true });
    }
  });
});
