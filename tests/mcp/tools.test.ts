/**
 * Comprehensive tests for MCP tools
 * Tests all 9 MCP tool handlers
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import {
  createTestRepositoryWithData,
} from '../db/helpers.js';
import { initializeClient, closeClient, resetClient } from '../../src/db/client.js';
import { query } from '../../src/mcp/tools/query.js';
import { listRepositories } from '../../src/mcp/tools/list.js';
import { listFiles } from '../../src/mcp/tools/files.js';
import { getDirectories } from '../../src/mcp/tools/dirs.js';
import { getInfo } from '../../src/mcp/tools/info.js';
import { getStats } from '../../src/mcp/tools/stats.js';
import { getFileInfo } from '../../src/mcp/tools/context.js';
import { readFile } from '../../src/mcp/tools/read.js';
import { findSimilar } from '../../src/mcp/tools/similar.js';

let testDb: PGlite;
let testRepoId: number;
let testRepoName: string;

describe('MCP Tools - Setup', () => {
  beforeEach(async () => {
    resetClient();
    testDb = await initializeClient({
      dataDir: 'memory://',
      autoMigrate: true,
    });

    const data = await createTestRepositoryWithData(testDb);
    testRepoId = data.repositoryId;
    testRepoName = 'test-repo';
  });

  afterEach(async () => {
    await closeClient();
    resetClient();
  });

  describe('Tool: query', () => {
    it('should perform semantic search', async () => {
      const results = await query({
        query: 'test repository',
        repository: testRepoName,
        limit: 10,
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      results.forEach(result => {
        expect(result).toHaveProperty('repository');
        expect(result).toHaveProperty('filePath');
        expect(result).toHaveProperty('content');
        expect(result).toHaveProperty('similarity');
        expect(result.similarity).toBeGreaterThanOrEqual(0);
        expect(result.similarity).toBeLessThanOrEqual(1);
      });
    });

    it('should filter by repository', async () => {
      const results = await query({
        query: 'test',
        repository: testRepoName,
      });

      results.forEach(result => {
        expect(result.repository).toBe(testRepoName);
      });
    });

    it('should limit results', async () => {
      const results = await query({
        query: 'test',
        repository: testRepoName,
        limit: 2,
      });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should throw on empty query', async () => {
      await expect(
        query({ query: '', repository: testRepoName })
      ).rejects.toThrow();
    });

    it('should throw on invalid repository', async () => {
      await expect(
        query({ query: 'test', repository: 'nonexistent' })
      ).rejects.toThrow();
    });
  });

  describe('Tool: repos (listRepositories)', () => {
    it('should list all repositories', async () => {
      const repos = await listRepositories();

      expect(Array.isArray(repos)).toBe(true);
      expect(repos.length).toBeGreaterThan(0);

      repos.forEach(repo => {
        expect(repo).toHaveProperty('id');
        expect(repo).toHaveProperty('name');
        expect(repo).toHaveProperty('fileCount');
        expect(typeof repo.fileCount).toBe('number');
      });
    });

    it('should include test repository', async () => {
      const repos = await listRepositories();
      const testRepo = repos.find(r => r.name === testRepoName);

      expect(testRepo).toBeDefined();
      expect(testRepo?.fileCount).toBeGreaterThan(0);
    });
  });

  describe('Tool: files (listFiles)', () => {
    it('should list files in repository', async () => {
      const result = await listFiles({
        repository: testRepoName,
        limit: 100,
      });

      expect(result).toHaveProperty('repository');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('files');
      expect(Array.isArray(result.files)).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);
    });

    it('should paginate results', async () => {
      const page1 = await listFiles({
        repository: testRepoName,
        limit: 1,
        offset: 0,
      });

      expect(page1.files.length).toBe(1);
      expect(page1.more).toBe(true);

      const page2 = await listFiles({
        repository: testRepoName,
        limit: 1,
        offset: 1,
      });

      expect(page2.files.length).toBe(1);
      expect(page1.files[0]).not.toBe(page2.files[0]);
    });

    it('should filter by path', async () => {
      const result = await listFiles({
        repository: testRepoName,
        path: 'src/',
      });

      result.files.forEach(file => {
        expect(file.startsWith('src/')).toBe(true);
      });
    });

    it('should filter by pattern', async () => {
      const result = await listFiles({
        repository: testRepoName,
        pattern: '*.ts',
      });

      result.files.forEach(file => {
        expect(file.endsWith('.ts')).toBe(true);
      });
    });

    it('should throw on invalid repository', async () => {
      await expect(
        listFiles({ repository: 'nonexistent' })
      ).rejects.toThrow();
    });
  });

  describe('Tool: dirs (getDirectories)', () => {
    it('should list directories', async () => {
      const result = await getDirectories({
        repository: testRepoName,
        depth: 0,
      });

      expect(result).toHaveProperty('repository');
      expect(result).toHaveProperty('directories');
      expect(Array.isArray(result.directories)).toBe(true);
    });

    it('should filter by depth', async () => {
      const depth0 = await getDirectories({
        repository: testRepoName,
        depth: 0,
      });

      const depth1 = await getDirectories({
        repository: testRepoName,
        depth: 1,
      });

      // Depth 1 should have more or equal directories
      expect(depth1.directories.length).toBeGreaterThanOrEqual(depth0.directories.length);
    });

    it('should paginate directories', async () => {
      const result = await getDirectories({
        repository: testRepoName,
        limit: 1,
        offset: 0,
      });

      if (result.total > 1) {
        expect(result.more).toBe(true);
        expect(result.next).toBe(1);
      }
    });
  });

  describe('Tool: info (getInfo)', () => {
    it('should get repository info', async () => {
      const info = await getInfo({
        repository: testRepoName,
      });

      expect(info).toHaveProperty('repository');
      expect(info).toHaveProperty('path');
      expect(info).toHaveProperty('fileCount');
      expect(info).toHaveProperty('chunkCount');
      expect(info.repository).toBe(testRepoName);
      expect(typeof info.fileCount).toBe('number');
      expect(typeof info.chunkCount).toBe('number');
    });

    it('should throw on invalid repository', async () => {
      await expect(
        getInfo({ repository: 'nonexistent' })
      ).rejects.toThrow();
    });
  });

  describe('Tool: stats (getStats)', () => {
    it('should get repository statistics', async () => {
      const stats = await getStats({
        repository: testRepoName,
      });

      expect(stats).toHaveProperty('repository');
      expect(stats).toHaveProperty('totalFiles');
      expect(stats).toHaveProperty('codeFiles');
      expect(stats).toHaveProperty('textFiles');
      expect(stats).toHaveProperty('binaryFiles');
      expect(stats).toHaveProperty('totalChunks');
      expect(stats).toHaveProperty('totalEmbeddings');
      expect(stats).toHaveProperty('extensions');

      expect(typeof stats.totalFiles).toBe('number');
      expect(typeof stats.extensions).toBe('object');
    });

    it('should count file types correctly', async () => {
      const stats = await getStats({
        repository: testRepoName,
      });

      const total = stats.codeFiles + stats.textFiles + stats.binaryFiles;
      expect(total).toBe(stats.totalFiles);
    });

    it('should throw on invalid repository', async () => {
      await expect(
        getStats({ repository: 'nonexistent' })
      ).rejects.toThrow();
    });
  });

  describe('Tool: file_info (getFileInfo)', () => {
    it('should get file metadata', async () => {
      const info = await getFileInfo({
        repository: testRepoName,
        filePath: 'README.md',
      });

      expect(info).toHaveProperty('path');
      expect(info).toHaveProperty('fileType');
      expect(info).toHaveProperty('size');
      expect(info.path).toBe('README.md');
      expect(['code', 'text', 'binary']).toContain(info.fileType);
    });

    it('should NOT return absolutePath', async () => {
      const info = await getFileInfo({
        repository: testRepoName,
        filePath: 'README.md',
      });

      expect(info).not.toHaveProperty('absolutePath');
    });

    it('should throw on nonexistent file', async () => {
      await expect(
        getFileInfo({
          repository: testRepoName,
          filePath: 'nonexistent.ts',
        })
      ).rejects.toThrow();
    });
  });

  describe('Tool: read (readFile)', () => {
    it('should read file content', async () => {
      const result = await readFile({
        repository: testRepoName,
        filePath: 'README.md',
      });

      expect(result).toHaveProperty('repository');
      expect(result).toHaveProperty('filePath');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('fileType');
      expect(result).toHaveProperty('size');
      expect(typeof result.content).toBe('string');
    });

    it('should handle binary files', async () => {
      const result = await readFile({
        repository: testRepoName,
        filePath: 'assets/logo.png',
      });

      expect(result.fileType).toBe('binary');
      expect(result.content).toContain('Binary file');
    });

    it('should throw on nonexistent file', async () => {
      await expect(
        readFile({
          repository: testRepoName,
          filePath: 'nonexistent.ts',
        })
      ).rejects.toThrow();
    });

    it('should throw on invalid repository', async () => {
      await expect(
        readFile({
          repository: 'nonexistent',
          filePath: 'README.md',
        })
      ).rejects.toThrow();
    });
  });

  describe('Tool: similar (findSimilar)', () => {
    it('should find similar code', async () => {
      const results = await findSimilar({
        repository: testRepoName,
        filePath: 'README.md',
        limit: 5,
      });

      expect(Array.isArray(results)).toBe(true);

      results.forEach(result => {
        expect(result).toHaveProperty('repository');
        expect(result).toHaveProperty('filePath');
        expect(result).toHaveProperty('content');
        expect(result).toHaveProperty('similarity');
      });
    });

    it('should limit results', async () => {
      const results = await findSimilar({
        repository: testRepoName,
        filePath: 'README.md',
        limit: 2,
      });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should throw on nonexistent file', async () => {
      await expect(
        findSimilar({
          repository: testRepoName,
          filePath: 'nonexistent.ts',
        })
      ).rejects.toThrow();
    });
  });
});

describe('MCP Tools - Error Handling', () => {
  it('should handle missing required parameters', async () => {
    await expect(query({ query: '' } as any)).rejects.toThrow();
    await expect(listFiles({} as any)).rejects.toThrow();
    await expect(getInfo({} as any)).rejects.toThrow();
  });

  it('should handle invalid parameter types', async () => {
    await expect(
      query({ query: 123 as any, repository: 'test' })
    ).rejects.toThrow();

    await expect(
      listFiles({ repository: 'test', limit: 'invalid' as any })
    ).rejects.toThrow();
  });

  it('should handle null parameters', async () => {
    await expect(
      query({ query: null as any, repository: 'test' })
    ).rejects.toThrow();
  });
});
