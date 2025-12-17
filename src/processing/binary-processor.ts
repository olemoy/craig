import fs from 'fs';
import {sha256Hex} from './hasher';

export async function processBinary(filePath: string) {
  const stat = await fs.promises.stat(filePath);
  const size = stat.size;
  const buf = await fs.promises.readFile(filePath);
  const hash = sha256Hex(buf.toString('binary'));
  return {
    size,
    hash,
  };
}
