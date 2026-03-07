import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'
import Anthropic from '@anthropic-ai/sdk'

interface ClaudeOAuthCredentials {
  accessToken: string
  refreshToken: string
  expiresAt: number
  subscriptionType: string
  rateLimitTier: string
}

// Module-level cache: survives within the same Lambda/process invocation
let _cachedToken: { accessToken: string; expiresAt: number } | null = null

// Claude Code CLI OAuth client_id (official, used by Claude Code CLI)
const CLAUDE_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e'
const CLAUDE_TOKEN_ENDPOINT = 'https://console.anthropic.com/api/oauth/token'

/**
 * Refreshes the OAuth access token using the refresh token.
 * Calls Anthropic's token endpoint with the refresh_token grant.
 */
async function refreshOAuthToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch(CLAUDE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CLAUDE_CLIENT_ID,
      }),
    })
    if (!res.ok) return null
    const data = await res.json() as { access_token?: string; expires_in?: number }
    if (!data.access_token) return null
    const expiresAt = Date.now() + (data.expires_in ?? 28800) * 1000
    _cachedToken = { accessToken: data.access_token, expiresAt }
    return data.access_token
  } catch {
    return null
  }
}

/**
 * Reads credentials from env vars — used on Vercel/cloud deployments.
 * Supports: CLAUDE_ACCESS_TOKEN + CLAUDE_TOKEN_EXPIRES_AT + CLAUDE_REFRESH_TOKEN
 */
async function getEnvVarToken(): Promise<string | null> {
  const refreshToken = process.env.CLAUDE_REFRESH_TOKEN
  if (!refreshToken) return null

  // Use module-level cache first
  if (_cachedToken && Date.now() < _cachedToken.expiresAt - 60_000) {
    return _cachedToken.accessToken
  }

  // Try env var access token (valid for up to 8h)
  const accessToken = process.env.CLAUDE_ACCESS_TOKEN
  const expiresAt = Number(process.env.CLAUDE_TOKEN_EXPIRES_AT ?? 0)
  if (accessToken && Date.now() < expiresAt - 60_000) {
    _cachedToken = { accessToken, expiresAt }
    return accessToken
  }

  // Access token expired — refresh using refresh token
  return await refreshOAuthToken(refreshToken)
}

/**
 * Reads Claude Code CLI credentials from the macOS keychain.
 */
function readMacOsCredentials(): ClaudeOAuthCredentials | null {
  try {
    const raw = execSync('security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null', {
      encoding: 'utf8',
      timeout: 3000,
    }).trim()
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const oauth = parsed?.claudeAiOauth
    if (!oauth?.accessToken) return null
    return oauth as ClaudeOAuthCredentials
  } catch {
    return null
  }
}

/**
 * Reads Claude Code CLI credentials from ~/.claude/.credentials.json
 * Used on Windows and Linux where the macOS keychain is unavailable.
 */
function readFileCredentials(): ClaudeOAuthCredentials | null {
  try {
    const home = process.env.HOME || process.env.USERPROFILE || ''
    const credPath = join(home, '.claude', '.credentials.json')
    const raw = readFileSync(credPath, 'utf8')
    const parsed = JSON.parse(raw)
    const oauth = parsed?.claudeAiOauth
    if (!oauth?.accessToken) return null
    return oauth as ClaudeOAuthCredentials
  } catch {
    return null
  }
}

function readCliCredentials(): ClaudeOAuthCredentials | null {
  if (process.platform === 'darwin') {
    return readMacOsCredentials() ?? readFileCredentials()
  }
  return readFileCredentials()
}

/**
 * Returns a valid OAuth access token.
 * Priority: env var (Vercel) → CLI credentials file (local)
 */
export async function getOAuthToken(): Promise<string | null> {
  // 1. Try env var OAuth (Vercel cloud deployments)
  const envToken = await getEnvVarToken()
  if (envToken) return envToken

  // 2. Try local CLI credentials file (local dev, Windows/Linux/macOS)
  const creds = readCliCredentials()
  if (!creds) return null
  if (Date.now() > creds.expiresAt) return null
  return creds.accessToken
}

/**
 * Creates an Anthropic client using OAuth Bearer token.
 * Supports both env var tokens (Vercel) and local CLI credentials.
 * Returns null if no OAuth credentials are available.
 */
export async function createCliAnthropicClient(baseURL?: string): Promise<Anthropic | null> {
  const token = await getOAuthToken()
  if (!token) return null

  return new Anthropic({
    authToken: token,
    defaultHeaders: {
      'anthropic-beta': 'oauth-2025-04-20',
    },
    ...(baseURL ? { baseURL } : {}),
  })
}

/**
 * Returns auth status for the settings UI.
 */
export async function getCliAuthStatus(): Promise<{
  available: boolean
  subscriptionType?: string
  expired?: boolean
}> {
  // Check env var OAuth
  if (process.env.CLAUDE_REFRESH_TOKEN) {
    const token = await getEnvVarToken()
    return { available: !!token, subscriptionType: 'oauth-env', expired: !token }
  }

  // Check local CLI credentials
  const creds = readCliCredentials()
  if (!creds) return { available: false }
  const expired = Date.now() > creds.expiresAt
  return { available: true, subscriptionType: creds.subscriptionType, expired }
}
