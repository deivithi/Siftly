import { NextRequest, NextResponse } from 'next/server'
import { syncBookmarks, getStoredCredentials, type XCredentials } from '@/lib/twitter-session'

export async function POST(request: NextRequest): Promise<NextResponse> {
  let creds: XCredentials | null = null

  // Try body first (manual call with explicit credentials)
  try {
    const body = await request.json() as { authToken?: string; ct0?: string; twid?: string; guestId?: string }
    if (body.authToken?.trim() && body.ct0?.trim()) {
      creds = {
        authToken: body.authToken.trim(),
        ct0: body.ct0.trim(),
        twid: body.twid?.trim(),
        guestId: body.guestId?.trim(),
      }
    }
  } catch {
    // empty body — will use stored credentials
  }

  // Fall back to DB-stored credentials
  if (!creds) {
    creds = await getStoredCredentials()
  }

  if (!creds) {
    return NextResponse.json(
      { error: 'Conecte sua conta X nas Configurações antes de sincronizar.' },
      { status: 400 }
    )
  }

  try {
    const result = await syncBookmarks(creds)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Falha ao buscar bookmarks do X' },
      { status: 500 }
    )
  }
}
