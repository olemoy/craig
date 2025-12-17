/**
 * Config command - display and validate configuration
 */

import { getEmbeddingProvider, loadConfig } from '../../config/index.js';
import { checkOllamaAvailability } from '../../embeddings/ollama.js';
import type { OllamaConfig } from '../../config/index.js';

export async function configCmd(args: string[]) {
  const subcommand = args[0];

  if (subcommand === 'show' || !subcommand) {
    await showConfig();
  } else if (subcommand === 'test') {
    await testConfig();
  } else {
    console.error('Usage: craig config [show|test]');
    console.error('  show - Display current configuration (default)');
    console.error('  test - Test embedding provider connectivity');
  }
}

async function showConfig() {
  try {
    const config = loadConfig();
    const provider = getEmbeddingProvider();

    console.log('\n📋 Current Configuration\n');
    console.log('Embedding Provider:', provider.provider);
    console.log('Dimensions:', provider.dimensions);
    console.log();

    if (provider.provider === 'ollama') {
      const ollamaConfig = provider.config as OllamaConfig;
      console.log('Ollama Settings:');
      console.log('  Base URL:', ollamaConfig.baseUrl);
      console.log('  Model:', ollamaConfig.model);
      if (ollamaConfig.options) {
        console.log('  Options:', JSON.stringify(ollamaConfig.options, null, 2));
      }
    } else {
      console.log('Transformers.js Settings:');
      console.log('  Model:', config.embedding.transformers.model);
    }

    console.log('\n💡 To change provider, edit config.json');
    console.log('   Example config: config.example.json\n');
  } catch (error) {
    console.error('Error reading config:', error instanceof Error ? error.message : String(error));
    console.error('\n💡 Create config.json from config.example.json');
  }
}

async function testConfig() {
  try {
    const provider = getEmbeddingProvider();

    console.log('\n🔍 Testing Embedding Provider\n');
    console.log('Provider:', provider.provider);

    if (provider.provider === 'ollama') {
      const ollamaConfig = provider.config as OllamaConfig;
      console.log('Checking Ollama at', ollamaConfig.baseUrl, '...');

      const availability = await checkOllamaAvailability(ollamaConfig);

      if (availability.available) {
        console.log('✓ Ollama is running');
        console.log('✓ Model', ollamaConfig.model, 'is available');

        // Test embedding generation
        console.log('\nTesting embedding generation...');
        const { embedTextOllama } = await import('../../embeddings/ollama.js');
        const testText = 'This is a test';
        const start = Date.now();
        const embedding = await embedTextOllama(testText, ollamaConfig);
        const duration = Date.now() - start;

        console.log('✓ Generated embedding in', duration, 'ms');
        console.log('  Dimensions:', embedding.length);
        console.log('  Sample values:', embedding.slice(0, 5).map(v => v.toFixed(4)).join(', '), '...');
      } else {
        console.error('✗ Ollama is not available:', availability.error);
        console.error('\nMake sure:');
        console.error('  1. Ollama is running: ollama serve');
        console.error('  2. Model is installed: ollama pull', ollamaConfig.model);
        process.exit(1);
      }
    } else {
      console.log('Testing Transformers.js...');

      const { getPipeline } = await import('../../embeddings/cache.js');
      await getPipeline();
      console.log('✓ Model loaded');

      // Test embedding generation
      console.log('\nTesting embedding generation...');
      const { embedText } = await import('../../embeddings/pipeline.js');
      const testText = 'This is a test';
      const start = Date.now();
      const embedding = await embedText(testText);
      const duration = Date.now() - start;

      console.log('✓ Generated embedding in', duration, 'ms');
      console.log('  Dimensions:', embedding.length);
      console.log('  Sample values:', embedding.slice(0, 5).map(v => v.toFixed(4)).join(', '), '...');
    }

    console.log('\n✓ Configuration test passed!\n');
  } catch (error) {
    console.error('\n✗ Configuration test failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
