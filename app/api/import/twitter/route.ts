import { NextRequest, NextResponse } from 'next/server'
import { syncBookmarks, getStoredCredentials } from '@/lib/twitter-session'

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Try body first; fall back to DB-stored credentials
  let authToken: string | undefined
  let ct0: string | undefined

  try {
    const body = await request.json() as { authToken?: string; ct0?: string }
    authToken = body.authToken?.trim()
    ct0 = body.ct0?.trim()
  } catch {
    // empty body — will use stored credentials
  }

  if (!authToken || !ct0) {
    const stored = await getStoredCredentials()
    if (!stored) {
      return NextResponse.json(
        { error: 'authToken e ct0 são obrigatórios (ou conecte sua conta X nas Configurações)' },
        { status: 400 }
      )
    }
    authToken = stored.authToken
    ct0 = stored.ct0
  }

  try {
    const result = await syncBookmarks(authToken, ct0)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Falha ao buscar bookmarks do X' },
      { status: 500 }
    )
  }
}
