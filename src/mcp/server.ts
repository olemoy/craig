#!/usr/bin/env node
/**
 * CRAIG MCP Server
 * Exposes code search and analysis capabilities via Model Context Protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { query, queryTool } from './tools/query.js';
import { getFileContext, getFileContextTool } from './tools/context.js';
import { analyzeCodebase, analyzeCodebaseTool } from './tools/analyze.js';
import { findSimilar, findSimilarTool } from './tools/similar.js';
import { listRepositories, listRepositoriesTool } from './tools/list.js';
import { listFiles, listFilesTool } from './tools/files.js';
import { getDirectories, getDirectoriesTool } from './tools/directories.js';
import { getStats, getStatsTool } from './tools/stats.js';
import { handleError } from './errors.js';

// Server instance
const server = new Server(
  {
    name: 'craig',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      queryTool,
      listRepositoriesTool,
      listFilesTool,
      getDirectoriesTool,
      getStatsTool,
      getFileContextTool,
      analyzeCodebaseTool,
      findSimilarTool,
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'query': {
        const results = await query(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results),
            },
          ],
        };
      }

      case 'repos': {
        const results = await listRepositories();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results),
            },
          ],
        };
      }

      case 'files': {
        const result = await listFiles(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result),
            },
          ],
        };
      }

      case 'directories': {
        const result = await getDirectories(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result),
            },
          ],
        };
      }

      case 'stats': {
        const result = await getStats(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result),
            },
          ],
        };
      }

      case 'read_file': {
        const result = await getFileContext(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result),
            },
          ],
        };
      }

      case 'analyze': {
        const result = await analyzeCodebase(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result),
            },
          ],
        };
      }

      case 'similar': {
        const results = await findSimilar(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    throw handleError(error);
  }
});

// Start the server
async function main() {
  // Set MCP mode flag to suppress noisy model loading output
  process.env.CRAIG_MCP_MODE = 'true';

  // Pre-load the embedding model to avoid lazy loading during tool calls
  // This prevents transformer library messages from appearing during MCP requests
  try {
    const { getPipeline } = await import('../embeddings/cache.js');
    console.error('Initializing embedding model...');
    await getPipeline();
    console.error('✓ Embedding model ready');
  } catch (error) {
    console.error('Warning: Failed to pre-load embedding model:', error);
    console.error('Model will be loaded on first use');
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr so it doesn't interfere with MCP protocol on stdout
  console.error('CRAIG MCP Server started');
  console.error('Capabilities: tools only');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
