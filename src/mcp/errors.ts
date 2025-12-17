/**
 * MCP error handling utilities
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export class CraigMcpError extends McpError {
  constructor(code: ErrorCode, message: string, data?: unknown) {
    super(code, message, data);
    this.name = 'CraigMcpError';
  }
}

export function handleError(error: unknown): McpError {
  if (error instanceof McpError) {
    return error;
  }

  if (error instanceof Error) {
    return new CraigMcpError(
      ErrorCode.InternalError,
      error.message,
      { stack: error.stack }
    );
  }

  return new CraigMcpError(
    ErrorCode.InternalError,
    'An unknown error occurred',
    { error: String(error) }
  );
}

export function createInvalidParamsError(message: string): McpError {
  return new CraigMcpError(ErrorCode.InvalidParams, message);
}

export function createNotFoundError(message: string): McpError {
  return new CraigMcpError(ErrorCode.InvalidRequest, message);
}
