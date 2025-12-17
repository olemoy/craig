import { modelConfig } from './config';

let pipelineInstance: any = null;
let initializing: Promise<any> | null = null;

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
    initializing = null;
    return pipelineInstance;
  })();
  return initializing;
}

export function clearPipelineCache() {
  pipelineInstance = null;
}
