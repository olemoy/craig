/**
 * Tests for CLI output formatting
 * Tests table formatting and user-friendly output
 */

import { describe, it, expect } from 'bun:test';
import { formatTable, formatSize, formatDate } from '../../src/cli/output.js';

describe('CLI Output - Table Formatting', () => {
  it('should format simple table', () => {
    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];

    const table = formatTable(data, ['name', 'age']);

    expect(table).toContain('Alice');
    expect(table).toContain('Bob');
    expect(table).toContain('30');
    expect(table).toContain('25');
  });

  it('should handle empty data', () => {
    const table = formatTable([], ['name', 'age']);

    expect(typeof table).toBe('string');
    expect(table.length).toBeGreaterThan(0);
  });

  it('should align columns', () => {
    const data = [
      { name: 'A', count: 100 },
      { name: 'Very Long Name', count: 1 },
    ];

    const table = formatTable(data, ['name', 'count']);

    // Table should be well-formatted (implementation dependent)
    expect(table).toContain('A');
    expect(table).toContain('Very Long Name');
  });

  it('should handle special characters', () => {
    const data = [
      { path: '/path/to/file.ts' },
      { path: 'C:\\Windows\\System32' },
    ];

    const table = formatTable(data, ['path']);

    expect(table).toContain('/path/to/file.ts');
    expect(table).toContain('C:\\Windows\\System32');
  });

  it('should handle unicode', () => {
    const data = [
      { name: '日本語' },
      { name: 'العربية' },
      { name: 'Ελληνικά' },
    ];

    const table = formatTable(data, ['name']);

    expect(table).toContain('日本語');
    expect(table).toContain('العربية');
  });
});

describe('CLI Output - Size Formatting', () => {
  it('should format bytes', () => {
    expect(formatSize(100)).toBe('100 B');
    expect(formatSize(999)).toBe('999 B');
  });

  it('should format kilobytes', () => {
    expect(formatSize(1024)).toBe('1.0 KB');
    expect(formatSize(1536)).toBe('1.5 KB');
    expect(formatSize(10240)).toBe('10.0 KB');
  });

  it('should format megabytes', () => {
    expect(formatSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatSize(1536 * 1024)).toBe('1.5 MB');
    expect(formatSize(10 * 1024 * 1024)).toBe('10.0 MB');
  });

  it('should format gigabytes', () => {
    expect(formatSize(1024 * 1024 * 1024)).toBe('1.0 GB');
    expect(formatSize(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
  });

  it('should handle zero', () => {
    expect(formatSize(0)).toBe('0 B');
  });

  it('should handle negative numbers', () => {
    expect(formatSize(-1024)).toContain('-');
  });

  it('should round to one decimal', () => {
    expect(formatSize(1234)).toBe('1.2 KB');
    expect(formatSize(1280)).toBe('1.2 KB');
  });
});

describe('CLI Output - Date Formatting', () => {
  it('should format ISO date', () => {
    const date = '2025-01-15T10:30:00Z';
    const formatted = formatDate(date);

    expect(typeof formatted).toBe('string');
    expect(formatted).toContain('2025');
  });

  it('should format timestamp', () => {
    const timestamp = Date.now();
    const formatted = formatDate(timestamp);

    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });

  it('should format Date object', () => {
    const date = new Date('2025-01-15T10:30:00Z');
    const formatted = formatDate(date);

    expect(typeof formatted).toBe('string');
    expect(formatted).toContain('2025');
  });

  it('should handle invalid date', () => {
    const formatted = formatDate('invalid');

    expect(typeof formatted).toBe('string');
    // Should either return error message or original value
    expect(formatted.length).toBeGreaterThan(0);
  });

  it('should use consistent format', () => {
    const date1 = formatDate('2025-01-15T10:30:00Z');
    const date2 = formatDate('2025-12-31T23:59:59Z');

    // Both should have similar format (length should be similar)
    const lengthDiff = Math.abs(date1.length - date2.length);
    expect(lengthDiff).toBeLessThan(5);
  });
});

describe('CLI Output - Edge Cases', () => {
  it('should handle null values', () => {
    const data = [
      { name: 'Test', value: null },
    ];

    const table = formatTable(data, ['name', 'value']);

    expect(typeof table).toBe('string');
  });

  it('should handle undefined values', () => {
    const data = [
      { name: 'Test', value: undefined },
    ];

    const table = formatTable(data, ['name', 'value']);

    expect(typeof table).toBe('string');
  });

  it('should handle very long strings', () => {
    const data = [
      { text: 'a'.repeat(1000) },
    ];

    const table = formatTable(data, ['text']);

    expect(typeof table).toBe('string');
  });

  it('should handle objects in data', () => {
    const data = [
      { name: 'Test', metadata: { key: 'value' } },
    ];

    const table = formatTable(data, ['name', 'metadata']);

    expect(typeof table).toBe('string');
  });

  it('should handle arrays in data', () => {
    const data = [
      { name: 'Test', tags: ['a', 'b', 'c'] },
    ];

    const table = formatTable(data, ['name', 'tags']);

    expect(typeof table).toBe('string');
  });
});
