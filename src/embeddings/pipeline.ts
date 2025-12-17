import { getPipeline } from './cache';
import { modelConfig } from './config';

function l2normalize(vec: number[]) {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0) || 1);
  return vec.map(v => v / norm);
}

export async function embedText(text: string): Promise<number[]> {
  const pipe = await getPipeline();
  const result = await pipe(text, { pooling: modelConfig.pooling });
  const vec: number[] = Array.isArray(result) && Array.isArray(result[0]) ? (result[0] as number[]) : (result as number[]);
  return modelConfig.normalize ? l2normalize(vec) : vec;
}
