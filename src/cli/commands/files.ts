/**
 * List files in a repository
 */

import { getClient } from '../../db/client.js';
import { getRepositoryByName, getRepositoryByPath, getRepository } from '../../db/repositories.js';
import type { RepositoryId } from '../../db/types.js';
import { toRepositoryId } from '../../db/types.js';

export async function filesCmd(args: string[]) {
  const repoParam = args[0];

  if (!repoParam) {
    console.error('Usage: craig files <name|id> [--tree]');
    return;
  }

  const showTree = args.includes('--tree');

  try {
    // Look up repository by name, path, or UUID
    let repo = await getRepositoryByName(repoParam);
    if (!repo) repo = await getRepositoryByPath(repoParam);
    if (!repo) {
      const repoId = toRepositoryId(repoParam);
      if (repoId) {
        repo = await getRepository(repoId);
      }
    }

    if (!repo) {
      console.error(`Repository '${repoParam}' not found.`);
      console.error('Use "bun cli list" to see available repositories.');
      return;
    }

    // Get all files
    const client = await getClient();
    const result = await client.query(
      `SELECT file_path, file_type, language, size_bytes
       FROM files
       WHERE repository_id = $1
       ORDER BY file_path`,
      [repo.id]
    );

    console.log(`\nFiles in "${repo.name}" (${result.rows.length} files):\n`);

    if (showTree) {
      // Show as tree structure
      const tree = buildFileTree(result.rows, repo.path);
      printTree(tree, '');
    } else {
      // Show as flat list with relative paths
      const repoPath = repo.path.endsWith('/') ? repo.path : repo.path + '/';

      for (const row of result.rows) {
        const relativePath = row.file_path.replace(repoPath, '');
        const size = formatSize(row.size_bytes);
        const type = row.file_type === 'binary' ? '📦' : row.file_type === 'code' ? '💻' : '📄';
        const lang = row.language ? ` [${row.language}]` : '';
        console.log(`${type} ${relativePath}${lang} (${size})`);
      }
    }

    console.log(`\nTotal: ${result.rows.length} files`);
  } catch (err) {
    console.error('Failed to list files:', err instanceof Error ? err.message : String(err));
  }
}

interface TreeNode {
  name: string;
  children: Map<string, TreeNode>;
  isFile: boolean;
  metadata?: {
    type: string;
    language: string | null;
    size: number;
  };
}

function buildFileTree(files: any[], repoPath: string): TreeNode {
  const root: TreeNode = { name: '', children: new Map(), isFile: false };
  const repoPathNormalized = repoPath.endsWith('/') ? repoPath : repoPath + '/';

  for (const file of files) {
    const relativePath = file.file_path.replace(repoPathNormalized, '');
    const parts = relativePath.split('/');

    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLastPart = i === parts.length - 1;

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          children: new Map(),
          isFile: isLastPart,
          metadata: isLastPart ? {
            type: file.file_type,
            language: file.language,
            size: file.size_bytes,
          } : undefined,
        });
      }

      current = current.children.get(part)!;
    }
  }

  return root;
}

function printTree(node: TreeNode, prefix: string, isLast: boolean = true) {
  if (node.name) {
    const connector = isLast ? '└── ' : '├── ';
    const icon = node.isFile
      ? (node.metadata?.type === 'binary' ? '📦' : node.metadata?.type === 'code' ? '💻' : '📄')
      : '📁';

    let line = prefix + connector + icon + ' ' + node.name;

    if (node.isFile && node.metadata) {
      const size = formatSize(node.metadata.size);
      const lang = node.metadata.language ? ` [${node.metadata.language}]` : '';
      line += lang + ` (${size})`;
    }

    console.log(line);
  }

  const children = Array.from(node.children.values());
  const newPrefix = node.name ? prefix + (isLast ? '    ' : '│   ') : '';

  children.forEach((child, index) => {
    printTree(child, newPrefix, index === children.length - 1);
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
