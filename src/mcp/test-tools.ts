#!/usr/bin/env node
/**
 * Simple test script for MCP tools
 * Tests each tool individually without the full MCP protocol
 */

import { query } from './tools/query.js';
import { getFileInfo } from './tools/context.js';
import { getStats } from './tools/stats.js';
import { findSimilar } from './tools/similar.js';
import { listRepositories } from './tools/list.js';

async function testTools() {
  console.log('Testing CRAIG MCP Tools\n');
  console.log('='.repeat(50));

  try {
    // Test 1: List repositories
    console.log('\n[1/5] Testing list_repositories...');
    const repos = await listRepositories();
    console.log(`✓ Found ${repos.length} repositories`);
    if (repos.length > 0) {
      console.log(`  - ${repos[0].name} (${repos[0].fileCount} files)`);
    }

    if (repos.length === 0) {
      console.log('\n⚠️  No repositories found. Please ingest a repository first:');
      console.log('   bun cli ingest /path/to/repo --name repo-name');
      return;
    }

    const testRepo = repos[0].name;

    // Test 2: Get stats
    console.log(`\n[2/5] Testing stats for "${testRepo}"...`);
    const stats = await getStats({ repository: testRepo });
    console.log(`✓ Repository stats:`);
    console.log(`  - Total files: ${stats.totalFiles}`);
    console.log(`  - Code files: ${stats.codeFiles}`);
    console.log(`  - Total chunks: ${stats.totalChunks}`);
    console.log(`  - Embeddings: ${stats.totalEmbeddings}`);

    // Test 3: Query code
    console.log(`\n[3/5] Testing query...`);
    const searchResults = await query({
      query: 'function',
      repository: testRepo,
      limit: 3,
    });
    console.log(`✓ Found ${searchResults.length} results`);
    if (searchResults.length > 0) {
      console.log(`  - Top result: ${searchResults[0].filePath}`);
      console.log(`    Similarity: ${(searchResults[0].similarity * 100).toFixed(1)}%`);
    }

    // Test 4: Get file info (if we have search results)
    if (searchResults.length > 0) {
      console.log(`\n[4/5] Testing file_info...`);
      const fileInfo = await getFileInfo({
        filePath: searchResults[0].filePath,
        repository: testRepo,
      });
      console.log(`✓ Retrieved file info: ${fileInfo.path}`);
      console.log(`  - Absolute path: ${fileInfo.absolutePath}`);
      console.log(`  - Type: ${fileInfo.fileType}`);
      console.log(`  - Language: ${fileInfo.language || 'unknown'}`);
      console.log(`  - Size: ${fileInfo.size} bytes`);
    } else {
      console.log(`\n[4/5] Skipping file_info (no search results)`);
    }

    // Test 5: Find similar
    if (searchResults.length > 0 && searchResults[0].content) {
      console.log(`\n[5/5] Testing find_similar...`);
      const sampleCode = searchResults[0].content.substring(0, 200);
      const similarResults = await findSimilar({
        code: sampleCode,
        repository: testRepo,
        limit: 3,
      });
      console.log(`✓ Found ${similarResults.length} similar code snippets`);
      if (similarResults.length > 0) {
        console.log(`  - Top match: ${similarResults[0].filePath}`);
        console.log(`    Similarity: ${(similarResults[0].similarity * 100).toFixed(1)}%`);
      }
    } else {
      console.log(`\n[5/5] Skipping find_similar (no code samples)`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✓ All tests passed!\n');
    console.log('The MCP server is ready to use with Claude Desktop.');
    console.log('See docs/mcp-setup.md for configuration instructions.\n');

  } catch (error) {
    console.error('\n✗ Test failed:', error);
    process.exit(1);
  }
}

testTools();
