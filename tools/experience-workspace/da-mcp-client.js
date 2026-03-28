/*
 * DA MCP Client
 * Calls DA operations via the MCP endpoint at mcp.adobeaemcloud.com
 * Uses MCP Streamable HTTP transport (JSON-RPC 2.0)
 *
 * Auth: passes IMS token as Bearer in Authorization header.
 * Falls back gracefully if the MCP endpoint is unreachable.
 */

import { getToken } from './ims.js';

const MCP_ENDPOINT = 'https://mcp.adobeaemcloud.com/adobe/mcp/da';
const MCP_PROTOCOL_VERSION = '2024-11-05';

let sessionId = null;
let requestId = 0;
let toolSchemas = null; // cached tool definitions from tools/list
let initPromise = null;

function nextId() {
  requestId += 1;
  return `ew-${requestId}`;
}

/**
 * Send a JSON-RPC request to the MCP endpoint.
 * Handles both direct JSON and SSE response formats.
 */
async function mcpRequest(method, params = {}, { isNotification = false } = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (sessionId) {
    headers['Mcp-Session-Id'] = sessionId;
  }

  const body = {
    jsonrpc: '2.0',
    method,
    params,
  };
  if (!isNotification) {
    body.id = nextId();
  }

  const resp = await fetch(MCP_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  // Capture session ID from response headers
  const newSessionId = resp.headers.get('mcp-session-id');
  if (newSessionId) {
    sessionId = newSessionId;
  }

  // Notifications don't expect a response body
  if (isNotification) return null;

  if (!resp.ok) {
    const errorText = await resp.text().catch(() => '');
    throw new Error(`MCP error ${resp.status}: ${errorText}`);
  }

  const contentType = resp.headers.get('content-type') || '';

  // SSE response — parse event stream for the result
  if (contentType.includes('text/event-stream')) {
    return parseSSEResponse(resp);
  }

  // Direct JSON response
  const json = await resp.json();
  if (json.error) {
    throw new Error(`MCP RPC error: ${json.error.message || JSON.stringify(json.error)}`);
  }
  return json.result;
}

/**
 * Parse SSE (Server-Sent Events) response from MCP endpoint.
 * Looks for the JSON-RPC result in the event stream.
 */
async function parseSSEResponse(resp) {
  const text = await resp.text();
  const lines = text.split('\n');
  let lastData = null;

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      lastData = line.slice(6);
    }
  }

  if (!lastData) return null;

  try {
    const json = JSON.parse(lastData);
    if (json.error) {
      throw new Error(`MCP RPC error: ${json.error.message || JSON.stringify(json.error)}`);
    }
    return json.result;
  } catch (e) {
    if (e.message.startsWith('MCP RPC error')) throw e;
    return lastData; // Return raw text if not JSON
  }
}

/**
 * Initialize MCP session — must be called before any tool call.
 * Sends initialize + notifications/initialized handshake.
 * Caches the session for reuse.
 */
export async function initSession() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Step 1: Initialize
      const initResult = await mcpRequest('initialize', {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: {
          name: 'experience-workspace',
          version: '1.0.0',
        },
      });

      console.log('[DA-MCP] Session initialized:', initResult?.serverInfo?.name || 'unknown');

      // Step 2: Send initialized notification
      await mcpRequest('notifications/initialized', {}, { isNotification: true });

      // Step 3: Discover available tools
      const toolsResult = await mcpRequest('tools/list', {});
      if (toolsResult?.tools) {
        toolSchemas = {};
        for (const tool of toolsResult.tools) {
          toolSchemas[tool.name] = tool;
        }
        console.log('[DA-MCP] Available tools:', Object.keys(toolSchemas).join(', '));
      }

      return true;
    } catch (err) {
      console.warn('[DA-MCP] Init failed:', err.message);
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

/**
 * Call a DA MCP tool by name.
 * Automatically initializes the session if needed.
 */
export async function callTool(toolName, args = {}) {
  await initSession();

  const result = await mcpRequest('tools/call', {
    name: toolName,
    arguments: args,
  });

  // MCP tool results have a content array
  if (result?.content) {
    // Return the text content if single text result
    const textItems = result.content.filter((c) => c.type === 'text');
    if (textItems.length === 1) {
      try {
        return JSON.parse(textItems[0].text);
      } catch {
        return textItems[0].text;
      }
    }
    return result.content;
  }

  return result;
}

/**
 * Get discovered tool schemas (available after initSession).
 */
export function getToolSchemas() {
  return toolSchemas;
}

/**
 * Reset session — forces re-initialization on next call.
 */
export function resetSession() {
  sessionId = null;
  toolSchemas = null;
  initPromise = null;
  requestId = 0;
}

/* ─── Convenience wrappers mapping to DA MCP tools ─── */

export async function listSources(org, repo, path = '/') {
  return callTool('da_list_sources', { org, repo, path });
}

export async function getSource(org, repo, path) {
  return callTool('da_get_source', { org, repo, path });
}

export async function createSource(org, repo, path, content) {
  return callTool('da_create_source', { org, repo, path, content });
}

export async function updateSource(org, repo, path, content) {
  return callTool('da_update_source', { org, repo, path, content });
}

export async function deleteSource(org, repo, path) {
  return callTool('da_delete_source', { org, repo, path });
}

export async function copyContent(org, repo, source, destination) {
  return callTool('da_copy_content', { org, repo, source, destination });
}

export async function moveContent(org, repo, source, destination) {
  return callTool('da_move_content', { org, repo, source, destination });
}

export async function getVersions(org, repo, path) {
  return callTool('da_get_versions', { org, repo, path });
}

/**
 * Check if MCP endpoint is reachable and session can be established.
 */
export async function isAvailable() {
  try {
    await initSession();
    return true;
  } catch {
    return false;
  }
}
