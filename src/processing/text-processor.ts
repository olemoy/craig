import fs from 'fs';

export async function readTextFile(filePath: string): Promise<string> {
  const buf = await fs.promises.readFile(filePath);
  // naive UTF-8 conversion; in edge cases this may throw
  let s = buf.toString('utf8');
  // normalize newlines
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return s;
}
