/**
 * MCP Resource handlers
 * Provides access to repositories and files as resources
 */

import { getClient } from '../../db/client.js';
import { listRepositories as listRepos } from '../../db/repositories.js';
import { getFilesByRepository } from '../../db/files.js';
import type { RepositoryId } from '../../db/types.js';

export interface ResourceTemplate {
  uriTemplate: string;
  name: string;
  description: string;
  mimeType?: string;
}

export const resourceTemplates: ResourceTemplate[] = [
  {
    uriTemplate: 'craig://repositories',
    name: 'All Repositories',
    description: 'List of all indexed repositories',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'craig://repository/{id}',
    name: 'Repository Details',
    description: 'Detailed information about a specific repository',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'craig://repository/{id}/files',
    name: 'Repository Files',
    description: 'List of all files in a repository',
    mimeType: 'application/json',
  },
];

export async function handleResourceRead(uri: string): Promise<{
  contents: Array<{ uri: string; mimeType?: string; text: string }>;
}> {
  const url = new URL(uri);

  // Handle repositories list
  if (url.pathname === '/repositories') {
    const repos = await listRepos();
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(repos, null, 2),
        },
      ],
    };
  }

  // Handle repository details
  const repoMatch = url.pathname.match(/^\/repository\/(\d+)$/);
  if (repoMatch) {
    const repoId = parseInt(repoMatch[1], 10) as RepositoryId;
    const client = await getClient();

    const result = await client.query(
      `SELECT
        r.id,
        r.name,
        r.path,
        r.commit_sha,
        r.ingested_at,
        COUNT(f.id) as file_count
      FROM repositories r
      LEFT JOIN files f ON f.repository_id = r.id
      WHERE r.id = $1
      GROUP BY r.id`,
      [repoId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Repository with id ${repoId} not found`);
    }

    const repo = result.rows[0];
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            id: repo.id,
            name: repo.name,
            path: repo.path,
            commitSha: repo.commit_sha,
            ingestedAt: repo.ingested_at,
            fileCount: parseInt(repo.file_count, 10),
          }, null, 2),
        },
      ],
    };
  }

  // Handle repository files
  const filesMatch = url.pathname.match(/^\/repository\/(\d+)\/files$/);
  if (filesMatch) {
    const repoId = parseInt(filesMatch[1], 10) as RepositoryId;
    const files = await getFilesByRepository(repoId);

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(
            files.map(f => ({
              id: f.id,
              path: f.file_path,
              type: f.file_type,
              language: f.language,
              size: f.size_bytes,
              lastModified: f.last_modified,
            })),
            null,
            2
          ),
        },
      ],
    };
  }

  throw new Error(`Unknown resource URI: ${uri}`);
}

export async function handleResourceList(): Promise<{
  resources: Array<{ uri: string; name: string; description?: string; mimeType?: string }>;
}> {
  const repos = await listRepos();

  const resources = [
    {
      uri: 'craig://repositories',
      name: 'All Repositories',
      description: 'List of all indexed repositories',
      mimeType: 'application/json',
    },
  ];

  // Add individual repository resources
  for (const repo of repos) {
    resources.push({
      uri: `craig://repository/${repo.id}`,
      name: `Repository: ${repo.name}`,
      description: `Details for ${repo.name}`,
      mimeType: 'application/json',
    });

    resources.push({
      uri: `craig://repository/${repo.id}/files`,
      name: `Files in ${repo.name}`,
      description: `List of files in ${repo.name}`,
      mimeType: 'application/json',
    });
  }

  return { resources };
}
