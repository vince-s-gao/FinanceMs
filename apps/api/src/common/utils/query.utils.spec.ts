import { parseDateRangeEnd, parseDateRangeStart, resolveSortField } from './query.utils';

describe('query.utils', () => {
  describe('parseDateRangeStart', () => {
    it('should parse date-only string to start of day', () => {
      const result = parseDateRangeStart('2026-03-17');

      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(2);
      expect(result.getDate()).toBe(17);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it('should keep datetime string as-is', () => {
      const input = '2026-03-17T10:30:45.123Z';
      const result = parseDateRangeStart(input);
      expect(result.getTime()).toBe(new Date(input).getTime());
    });
  });

  describe('parseDateRangeEnd', () => {
    it('should parse date-only string to end of day', () => {
      const result = parseDateRangeEnd('2026-03-17');

      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(2);
      expect(result.getDate()).toBe(17);
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
      expect(result.getMilliseconds()).toBe(999);
    });

    it('should keep datetime string as-is', () => {
      const input = '2026-03-17T10:30:45.123Z';
      const result = parseDateRangeEnd(input);
      expect(result.getTime()).toBe(new Date(input).getTime());
    });
  });

  describe('resolveSortField', () => {
    const allowed = ['createdAt', 'updatedAt', 'name'] as const;

    it('should return fallback when sortBy is missing', () => {
      expect(resolveSortField(undefined, allowed, 'createdAt')).toBe('createdAt');
    });

    it('should return fallback when sortBy is invalid', () => {
      expect(resolveSortField('DROP_TABLE', allowed, 'createdAt')).toBe('createdAt');
    });

    it('should return sortBy when sortBy is allowed', () => {
      expect(resolveSortField('name', allowed, 'createdAt')).toBe('name');
    });
  });
});
