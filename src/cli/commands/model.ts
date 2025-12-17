import { getPipeline } from '../../embeddings/cache.js';

export async function modelCmd(args: string[]) {
  const action = args[0];
  if (!action || action === 'help') {
    console.log('Usage: craig model fetch');
    return;
  }
  if (action === 'fetch') {
    try {
      console.log('Fetching model into ./models...');
      await getPipeline();
      console.log('Model fetch completed.');
    } catch (e) {
      console.error('Model fetch failed:', e instanceof Error ? e.message : String(e));
    }
    return;
  }
  console.error('Unknown model action:', action);
}
