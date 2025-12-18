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
        pipelineInstance = await transformers.pipeline('feature-extraction', localModelDir);
        initializing = null;
        return pipelineInstance;
      }

      // Otherwise set TRANSFORMERS_CACHE to models directory to cache downloads
      const modelsDir = resolveProjectPath('models');
      console.error(`Local model not found. Downloading ${modelConfig.modelId} into ${modelsDir} (this may take a while)`);
      process.env.TRANSFORMERS_CACHE = process.env.TRANSFORMERS_CACHE ?? modelsDir;
      const transformers = await import('@huggingface/transformers');
      pipelineInstance = await transformers.pipeline('feature-extraction', modelConfig.modelId);

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
      // Non-fatal
      console.error('Warning: Could not copy cached model to project models directory:', e);
    }

      initializing = null;
      return pipelineInstance;
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
