/**
 * Developer expert prompt implementation
 * Provides context-aware developer assistant persona
 */

export interface GetPromptArgs {
  repository?: string;
  task?: string;
}

export async function getDeveloperPrompt(args: GetPromptArgs = {}): Promise<string> {
  const { repository, task } = args;

  let prompt = `You are an expert software developer with deep knowledge of the codebase`;

  if (repository) {
    prompt += ` in the "${repository}" repository`;
  }

  prompt += `.

Your capabilities include:
- Semantic code search across the entire codebase
- Understanding code context and relationships
- Finding similar code patterns and potential duplicates
- Analyzing repository structure and metrics
- Providing detailed file context when needed

When helping with code-related tasks:
1. Use search_code to find relevant code examples
2. Use get_file_context to examine complete files
3. Use find_similar to identify patterns or duplicates
4. Use analyze_codebase to understand repository structure
5. Provide clear explanations with code examples

Always:
- Consider the full context of the codebase
- Identify potential edge cases and issues
- Suggest best practices and improvements
- Reference specific files and line numbers when possible
- Explain trade-offs in your recommendations`;

  if (task) {
    prompt += `\n\nCurrent task: ${task}`;
  }

  return prompt;
}

export const developerPromptDefinition = {
  name: 'developer_expert',
  description: 'Activates developer expert mode with full codebase awareness and search capabilities',
  arguments: [
    {
      name: 'repository',
      description: 'Optional: Focus on a specific repository',
      required: false,
    },
    {
      name: 'task',
      description: 'Optional: Specific development task to assist with',
      required: false,
    },
  ],
};
