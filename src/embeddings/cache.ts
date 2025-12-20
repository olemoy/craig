import { getModelConfig } from './config';
import { resolveProjectPath } from '../utils/paths.js';

let pipelineInstance: any = null;
let initializing: Promise<any> | null = null;

async function copyDir(src: string, dest: string) {
  const fs = await import('fs');
  const path = await import('path');
  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  for (const ent of entries) {
    const srcp = path.join(src, ent.name);
    const destp = path.join(dest, ent.name);
    if (ent.isDirectory()) {
      await copyDir(srcp, destp);
    } else if (ent.isFile()) {
      await fs.promises.copyFile(srcp, destp);
    }
  }
}

export async function getPipeline() {
  if (pipelineInstance) return pipelineInstance;
  if (initializing) return initializing;
  initializing = (async () => {
    // Suppress transformers.js console output (it goes to stdout/stderr)
    const originalError = console.error;
    const isMcpMode = process.env.CRAIG_MCP_MODE === 'true';

    if (isMcpMode) {
      // In MCP mode, redirect transformers output to stderr only
      console.error = (...args) => {
        // Only log to stderr, not to MCP stdout
        process.stderr.write(args.join(' ') + '\n');
      };
    }

    try {
      // Prefer local model under models/{modelId} if present
      const modelConfig = getModelConfig();
      const localModelDir = resolveProjectPath('models', modelConfig.modelId.replace(/\//g, '_'));
      const fs = await import('fs');
      if (fs.existsSync(localModelDir)) {
        console.error(`Using local model at ${localModelDir}`);
        const transformers = await import('@huggingface/transformers');
        try {
          pipelineInstance = await transformers.pipeline('feature-extraction', localModelDir);
        } catch (pipelineError) {
          // Clear the initializing flag so we can retry
          initializing = null;
          const errorMsg = pipelineError instanceof Error ? pipelineError.message : String(pipelineError);
          throw new Error(
            `Failed to load local model from ${localModelDir}\n` +
            `Error: ${errorMsg}\n\n` +
            `Possible solutions:\n` +
            `  1. Delete the corrupted local model: rm -rf "${localModelDir}"\n` +
            `  2. Re-download the model by running the ingest command again\n` +
            `  3. Check that the model files are not corrupted`
          );
        }
        initializing = null;
        return pipelineInstance;
      }

      // Otherwise set TRANSFORMERS_CACHE to models directory to cache downloads
      const modelsDir = resolveProjectPath('models');
      console.error(`Local model not found. Downloading ${modelConfig.modelId} into ${modelsDir} (this may take a while)`);
      process.env.TRANSFORMERS_CACHE = process.env.TRANSFORMERS_CACHE ?? modelsDir;
      const transformers = await import('@huggingface/transformers');
      try {
        pipelineInstance = await transformers.pipeline('feature-extraction', modelConfig.modelId);
      } catch (pipelineError) {
        // Clear the initializing flag so we can retry
        initializing = null;
        const errorMsg = pipelineError instanceof Error ? pipelineError.message : String(pipelineError);
        throw new Error(
          `Failed to download and load model ${modelConfig.modelId}\n` +
          `Error: ${errorMsg}\n\n` +
          `Possible solutions:\n` +
          `  1. Check your internet connection\n` +
          `  2. Verify the model ID is correct in config.json: "${modelConfig.modelId}"\n` +
          `  3. Try a different model (e.g., "Xenova/all-MiniLM-L6-v2")\n` +
          `  4. Check if you can access huggingface.co in your browser\n` +
          `  5. Check disk space in ${modelsDir}`
        );
      }

    // After pipeline is ready, try to detect where transformers cached the model and copy it to project models dir for reproducibility
    try {
      const os = await import('os');
      const path = await import('path');
      const candidate1 = path.join('node_modules', '@huggingface', 'transformers', '.cache', modelConfig.modelId);
      const candidate2 = path.join(os.homedir(), '.cache', 'huggingface', 'transformers', modelConfig.modelId);
      const candidate3 = path.join('node_modules', '@huggingface', 'transformers', '.cache', modelConfig.modelId.replace(/\//g, '_'));
      const localTarget = localModelDir;
      const fs = await import('fs');
      const candidates = [candidate1, candidate3, candidate2];
      for (const c of candidates) {
        if (fs.existsSync(c) && !fs.existsSync(localTarget)) {
          console.error(`Copying cached model from ${c} to ${localTarget}`);
          await copyDir(c, localTarget);
          console.error(`Model cached to ${localTarget}`);
          break;
        }
      }
    } catch (e) {
      // Non-fatal - model is already loaded and working
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error('⚠️  Warning: Could not copy cached model to project models directory');
      console.error(`   Error: ${errorMsg}`);
      console.error('   This is not critical - the model is loaded and working.');
      console.error('   However, future runs may need to re-download the model.');
    }

      initializing = null;
      return pipelineInstance;
    } catch (error) {
      // Clear the initializing flag so we can retry
      initializing = null;

      // Re-throw if it's already our formatted error
      if (error instanceof Error && error.message.includes('Possible solutions:')) {
        throw error;
      }

      // Otherwise, wrap unexpected errors with helpful context
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Unexpected error during model pipeline initialization\n` +
        `Error: ${errorMsg}\n\n` +
        `Possible solutions:\n` +
        `  1. Check the error message above for specific details\n` +
        `  2. Ensure @huggingface/transformers is properly installed: bun install\n` +
        `  3. Check your config.json for valid embedding configuration\n` +
        `  4. Try deleting the models directory and re-running: rm -rf models/\n` +
        `  5. Report this issue if it persists`
      );
    } finally {
      // Restore original console.error
      if (isMcpMode) {
        console.error = originalError;
      }
    }
  })();
  return initializing;
}

export function clearPipelineCache() {
  pipelineInstance = null;
}
