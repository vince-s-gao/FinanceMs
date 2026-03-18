import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: any;
  let jwtService: any;
  let configService: any;

  beforeEach(() => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('jwt-token'),
      verifyAsync: jest.fn(),
    };
    configService = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'JWT_REFRESH_EXPIRES_IN') return '30d';
        return fallback;
      }),
    };

    service = new AuthService(usersService, jwtService, configService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    (bcrypt.compare as jest.Mock).mockReset();
  });

  it('should reject login when user does not exist', async () => {
    usersService.findByEmail.mockResolvedValueOnce(null);

    await expect(
      service.login({
        email: 'missing@example.com',
        password: 'Password@123',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject login when user is inactive', async () => {
    usersService.findByEmail.mockResolvedValueOnce({
      id: 'u1',
      email: 'a@example.com',
      isActive: false,
    });

    await expect(
      service.login({
        email: 'a@example.com',
        password: 'Password@123',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject login when password is not set', async () => {
    usersService.findByEmail.mockResolvedValueOnce({
      id: 'u1',
      email: 'a@example.com',
      isActive: true,
      password: '',
    });

    await expect(
      service.login({
        email: 'a@example.com',
        password: 'Password@123',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject login when password is invalid', async () => {
    usersService.findByEmail.mockResolvedValueOnce({
      id: 'u1',
      email: 'a@example.com',
      name: 'User A',
      role: 'ADMIN',
      departmentId: null,
      avatar: null,
      isActive: true,
      password: 'hashed',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

    await expect(
      service.login({
        email: 'a@example.com',
        password: 'WrongPassword@1',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should login successfully and return token with projected user info', async () => {
    usersService.findByEmail.mockResolvedValueOnce({
      id: 'u1',
      email: 'a@example.com',
      name: 'User A',
      role: 'ADMIN',
      departmentId: 'd1',
      avatar: 'avatar.png',
      isActive: true,
      password: 'hashed',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

    const result = await service.login({
      email: 'a@example.com',
      password: 'Password@123',
    });

    expect(jwtService.sign).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sub: 'u1',
        email: 'a@example.com',
        role: 'ADMIN',
        type: 'access',
      }),
    );
    expect(jwtService.sign).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sub: 'u1',
        email: 'a@example.com',
        role: 'ADMIN',
        type: 'refresh',
      }),
      { expiresIn: '30d' },
    );
    expect(result.accessToken).toBe('jwt-token');
    expect(result.refreshToken).toBe('jwt-token');
    expect(result.user).toEqual({
      id: 'u1',
      email: 'a@example.com',
      name: 'User A',
      role: 'ADMIN',
      departmentId: 'd1',
      avatar: 'avatar.png',
    });
  });

  it('should reject validateToken when user does not exist', async () => {
    usersService.findById.mockResolvedValueOnce(null);

    await expect(service.validateToken({ sub: 'missing' })).rejects.toThrow(UnauthorizedException);
  });

  it('should reject validateToken when user is inactive', async () => {
    usersService.findById.mockResolvedValueOnce({
      id: 'u1',
      email: 'a@example.com',
      isActive: false,
    });

    await expect(service.validateToken({ sub: 'u1' })).rejects.toThrow(UnauthorizedException);
  });

  it('should return user when validateToken passes', async () => {
    usersService.findById.mockResolvedValueOnce({
      id: 'u1',
      email: 'a@example.com',
      isActive: true,
    });

    const result = await service.validateToken({ sub: 'u1' });
    expect(result.id).toBe('u1');
  });

  it('should reject refresh when token verification fails', async () => {
    jwtService.verifyAsync.mockRejectedValueOnce(new Error('bad token'));
    await expect(service.refresh('bad-refresh-token')).rejects.toThrow(UnauthorizedException);
  });

  it('should reject refresh when token type is not refresh', async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({ sub: 'u1', type: 'access' });
    await expect(service.refresh('access-token')).rejects.toThrow(UnauthorizedException);
  });

  it('should return new tokens and user when refresh succeeds', async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({ sub: 'u1', type: 'refresh' });
    usersService.findById.mockResolvedValueOnce({
      id: 'u1',
      email: 'a@example.com',
      name: 'User A',
      role: 'ADMIN',
      departmentId: 'd1',
      avatar: null,
      isActive: true,
    });
    jwtService.sign.mockReset();
    jwtService.sign.mockReturnValueOnce('new-access').mockReturnValueOnce('new-refresh');

    const result = await service.refresh('refresh-token');

    expect(result.accessToken).toBe('new-access');
    expect(result.refreshToken).toBe('new-refresh');
    expect(result.user.id).toBe('u1');
  });

  it('should validate password complexity for invalid and valid inputs', () => {
    const validate = (service as any).validatePasswordComplexity.bind(service);

    expect(() => validate('Aa1!')).toThrow(UnauthorizedException);
    expect(() => validate('abcdefgh')).toThrow(UnauthorizedException);
    expect(() => validate('Password@123')).not.toThrow();
  });

  it('should generate random password with expected length', () => {
    const password = service.generateRandomPassword();
    expect(password).toHaveLength(32);
  });
});
