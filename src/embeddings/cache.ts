import { modelConfig } from './config';

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
    // Prefer local model under ./models/{modelId} if present
    const localModelDir = `./models/${modelConfig.modelId.replace(/\//g, '_')}`;
    const fs = await import('fs');
    if (fs.existsSync(localModelDir)) {
      console.log(`Using local model at ${localModelDir}`);
      const transformers = await import('@huggingface/transformers');
      pipelineInstance = await transformers.pipeline('feature-extraction', localModelDir);
      initializing = null;
      return pipelineInstance;
    }

    // Otherwise set TRANSFORMERS_CACHE to ./models to cache downloads
    console.log(`Local model not found. Downloading ${modelConfig.modelId} into ./models (this may take a while)`);
    process.env.TRANSFORMERS_CACHE = process.env.TRANSFORMERS_CACHE ?? './models';
    const transformers = await import('@huggingface/transformers');
    pipelineInstance = await transformers.pipeline('feature-extraction', modelConfig.modelId);

    // After pipeline is ready, try to detect where transformers cached the model and copy it into ./models for reproducibility
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
          console.log(`Copying cached model from ${c} to ${localTarget}`);
          await copyDir(c, localTarget);
          console.log(`Model cached to ${localTarget}`);
          break;
        }
      }
    } catch (e) {
      // Non-fatal
      console.warn('Could not copy cached model into ./models:', e);
    }

    initializing = null;
    return pipelineInstance;
  })();
  return initializing;
}

export function clearPipelineCache() {
  pipelineInstance = null;
}
