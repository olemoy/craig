export type FileMeta = { path: string; type: 'text' | 'code' | 'binary' | string };

export type Chunk = {
  id: string;
  text: string;
  file: FileMeta;
};

export type Embedding = number[];

export interface ModelConfig {
  modelId: string;
  dimensions: number;
  pooling?: 'mean' | 'cls';
  normalize?: boolean;
}
