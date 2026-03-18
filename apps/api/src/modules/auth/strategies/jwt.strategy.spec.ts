import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const buildConfigService = (env = 'test', secret = 'test-jwt-secret-key-with-enough-length-123') => ({
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'NODE_ENV') return env;
      if (key === 'JWT_SECRET') return secret;
      return fallback;
    }),
  });

  it('should reject startup in production when jwt secret is weak', () => {
    const configService = buildConfigService('production', 'change-this-secret');
    const authService = { validateToken: jest.fn() };

    expect(() => new JwtStrategy(configService as any, authService as any)).toThrow(
      'JWT_SECRET 配置无效或过弱，生产环境禁止启动',
    );
  });

  it('should reject payload without sub', async () => {
    const configService = buildConfigService();
    const authService = { validateToken: jest.fn() };
    const strategy = new JwtStrategy(configService as any, authService as any);

    await expect(strategy.validate({})).rejects.toThrow(UnauthorizedException);
  });

  it('should reject non-access token type', async () => {
    const configService = buildConfigService();
    const authService = { validateToken: jest.fn() };
    const strategy = new JwtStrategy(configService as any, authService as any);

    await expect(strategy.validate({ sub: 'u1', type: 'refresh' })).rejects.toThrow(UnauthorizedException);
  });

  it('should pass valid access payload', async () => {
    const configService = buildConfigService();
    const authService = {
      validateToken: jest.fn().mockResolvedValue({
        id: 'u1',
        email: 'u1@example.com',
        isActive: true,
      }),
    };
    const strategy = new JwtStrategy(configService as any, authService as any);

    const result = await strategy.validate({ sub: 'u1', type: 'access' });

    expect(authService.validateToken).toHaveBeenCalledWith({ sub: 'u1', type: 'access' });
    expect(result.id).toBe('u1');
  });
});
