import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { syncBookmarks, getStoredCredentials } from '@/lib/twitter-session'

// Called by Vercel Cron (daily at 08:00 UTC / 05:00 BRT) and manually from the settings page.
export async function POST(request: NextRequest) {
  // Validate cron secret when called by Vercel scheduler
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const creds = await getStoredCredentials()
  if (!creds) {
    return NextResponse.json(
      { error: 'X não conectado. Configure auth_token e ct0 nas Configurações.' },
      { status: 400 }
    )
  }

  try {
    const result = await syncBookmarks(creds.authToken, creds.ct0)

    // Record last sync timestamp
    await prisma.setting.upsert({
      where: { key: 'twitterLastSync' },
      create: { key: 'twitterLastSync', value: new Date().toISOString() },
      update: { value: new Date().toISOString() },
    })

    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Falha ao sincronizar' },
      { status: 500 }
    )
  }
}

// Allow Vercel Cron to call via GET as well
export async function GET(request: NextRequest) {
  return POST(request)
}
