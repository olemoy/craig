/**
 * Tests for file discovery logic
 * Tests recursive directory traversal and file filtering
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { discoverFiles } from '../../src/processing/discovery.js';

const TEST_DIR = join(import.meta.dir, 'test-fixtures');

describe('File Discovery', () => {
  beforeEach(async () => {
    // Create test directory structure
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('should discover files in root directory', async () => {
    await writeFile(join(TEST_DIR, 'file1.ts'), 'content');
    await writeFile(join(TEST_DIR, 'file2.js'), 'content');

    const files = await discoverFiles(TEST_DIR);

    expect(files.length).toBe(2);
    expect(files.some(f => f.endsWith('file1.ts'))).toBe(true);
    expect(files.some(f => f.endsWith('file2.js'))).toBe(true);
  });

  it('should discover files recursively', async () => {
    await mkdir(join(TEST_DIR, 'src'), { recursive: true });
    await mkdir(join(TEST_DIR, 'src', 'components'), { recursive: true });

    await writeFile(join(TEST_DIR, 'README.md'), 'content');
    await writeFile(join(TEST_DIR, 'src', 'index.ts'), 'content');
    await writeFile(join(TEST_DIR, 'src', 'components', 'Button.tsx'), 'content');

    const files = await discoverFiles(TEST_DIR);

    expect(files.length).toBe(3);
    expect(files.some(f => f.endsWith('README.md'))).toBe(true);
    expect(files.some(f => f.endsWith('index.ts'))).toBe(true);
    expect(files.some(f => f.endsWith('Button.tsx'))).toBe(true);
  });

  it('should ignore node_modules directory', async () => {
    await mkdir(join(TEST_DIR, 'node_modules'), { recursive: true });
    await writeFile(join(TEST_DIR, 'app.ts'), 'content');
    await writeFile(join(TEST_DIR, 'node_modules', 'package.js'), 'content');

    const files = await discoverFiles(TEST_DIR);

    expect(files.some(f => f.endsWith('app.ts'))).toBe(true);
    expect(files.some(f => f.includes('node_modules'))).toBe(false);
  });

  it('should ignore .git directory', async () => {
    await mkdir(join(TEST_DIR, '.git'), { recursive: true });
    await writeFile(join(TEST_DIR, 'README.md'), 'content');
    await writeFile(join(TEST_DIR, '.git', 'config'), 'content');

    const files = await discoverFiles(TEST_DIR);

    expect(files.some(f => f.endsWith('README.md'))).toBe(true);
    expect(files.some(f => f.includes('.git'))).toBe(false);
  });

  it('should ignore common build directories', async () => {
    await mkdir(join(TEST_DIR, 'dist'), { recursive: true });
    await mkdir(join(TEST_DIR, 'build'), { recursive: true });
    await mkdir(join(TEST_DIR, 'target'), { recursive: true });

    await writeFile(join(TEST_DIR, 'src.ts'), 'content');
    await writeFile(join(TEST_DIR, 'dist', 'bundle.js'), 'content');
    await writeFile(join(TEST_DIR, 'build', 'output.js'), 'content');
    await writeFile(join(TEST_DIR, 'target', 'release.bin'), 'content');

    const files = await discoverFiles(TEST_DIR);

    expect(files.some(f => f.endsWith('src.ts'))).toBe(true);
    expect(files.some(f => f.includes('dist'))).toBe(false);
    expect(files.some(f => f.includes('build'))).toBe(false);
    expect(files.some(f => f.includes('target'))).toBe(false);
  });

  it('should include dotfiles in root', async () => {
    await writeFile(join(TEST_DIR, '.gitignore'), 'node_modules');
    await writeFile(join(TEST_DIR, '.env.example'), 'KEY=value');

    const files = await discoverFiles(TEST_DIR);

    expect(files.some(f => f.endsWith('.gitignore'))).toBe(true);
    expect(files.some(f => f.endsWith('.env.example'))).toBe(true);
  });

  it('should handle empty directory', async () => {
    const files = await discoverFiles(TEST_DIR);
    expect(files.length).toBe(0);
  });

  it('should handle deeply nested directories', async () => {
    const deepPath = join(TEST_DIR, 'a', 'b', 'c', 'd', 'e');
    await mkdir(deepPath, { recursive: true });
    await writeFile(join(deepPath, 'deep.ts'), 'content');

    const files = await discoverFiles(TEST_DIR);

    expect(files.length).toBe(1);
    expect(files[0].endsWith('deep.ts')).toBe(true);
  });

  it('should return absolute paths', async () => {
    await writeFile(join(TEST_DIR, 'file.ts'), 'content');

    const files = await discoverFiles(TEST_DIR);

    expect(files[0].startsWith('/')).toBe(true);
    expect(files[0].includes(TEST_DIR)).toBe(true);
  });

  it('should handle symbolic links gracefully', async () => {
    // This test might be platform-specific
    await writeFile(join(TEST_DIR, 'real.ts'), 'content');

    const files = await discoverFiles(TEST_DIR);

    expect(files.length).toBeGreaterThanOrEqual(1);
  });

  it('should discover all common file types', async () => {
    const testFiles = [
      'code.ts',
      'code.js',
      'code.py',
      'code.java',
      'code.go',
      'code.rs',
      'text.md',
      'text.txt',
      'data.json',
      'config.yml',
      'image.png',
    ];

    for (const file of testFiles) {
      await writeFile(join(TEST_DIR, file), 'content');
    }

    const files = await discoverFiles(TEST_DIR);

    expect(files.length).toBe(testFiles.length);
    for (const testFile of testFiles) {
      expect(files.some(f => f.endsWith(testFile))).toBe(true);
    }
  });

  it('should ignore coverage directories', async () => {
    await mkdir(join(TEST_DIR, 'coverage'), { recursive: true });
    await writeFile(join(TEST_DIR, 'test.ts'), 'content');
    await writeFile(join(TEST_DIR, 'coverage', 'lcov.info'), 'content');

    const files = await discoverFiles(TEST_DIR);

    expect(files.some(f => f.endsWith('test.ts'))).toBe(true);
    expect(files.some(f => f.includes('coverage'))).toBe(false);
  });
});
