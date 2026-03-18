import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UploadController } from '../src/modules/upload/upload.controller';
import { UploadService } from '../src/modules/upload/upload.service';

jest.mock('uuid', () => ({
  v4: () => 'mock-uuid',
}));

describe('UploadController Flow (e2e-like)', () => {
  let controller: UploadController;

  const serviceMock = {
    saveFile: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [{ provide: UploadService, useValue: serviceMock }],
    }).compile();

    controller = moduleRef.get(UploadController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw BadRequestException when file is missing', async () => {
    await expect(controller.uploadFile(undefined as any, 'temp')).rejects.toThrow(BadRequestException);
  });

  it('should pass file and category to upload service', async () => {
    serviceMock.saveFile.mockResolvedValueOnce({
      url: '/uploads/temp/a.pdf',
      filename: 'a.pdf',
    });

    const file = {
      originalname: 'a.pdf',
      mimetype: 'application/pdf',
      size: 100,
      buffer: Buffer.from('dummy'),
    } as any;

    const result = await controller.uploadFile(file, 'temp');

    expect(serviceMock.saveFile).toHaveBeenCalledWith(file, 'temp');
    expect(result.url).toContain('/uploads/temp');
  });
});
