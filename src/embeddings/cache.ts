import { modelConfig } from './config';

let pipelineInstance: any = null;
let initializing: Promise<any> | null = null;

export async function getPipeline() {
  if (pipelineInstance) return pipelineInstance;
  if (initializing) return initializing;
  initializing = (async () => {
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
