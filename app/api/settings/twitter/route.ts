import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET() {
  const [tokenRow, ct0Row, lastSyncRow] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'twitterAuthToken' } }),
    prisma.setting.findUnique({ where: { key: 'twitterCt0' } }),
    prisma.setting.findUnique({ where: { key: 'twitterLastSync' } }),
  ])

  const hasToken = !!tokenRow?.value
  const token = tokenRow?.value ?? ''

  return NextResponse.json({
    connected: hasToken && !!ct0Row?.value,
    hasToken,
    hasCt0: !!ct0Row?.value,
    maskedToken: hasToken ? token.slice(0, 6) + '••••••••' + token.slice(-4) : null,
    lastSync: lastSyncRow?.value ?? null,
  })
}

export async function POST(request: NextRequest) {
  let body: { authToken?: string; ct0?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { authToken, ct0 } = body
  if (!authToken?.trim() || !ct0?.trim()) {
    return NextResponse.json({ error: 'authToken e ct0 são obrigatórios' }, { status: 400 })
  }

  await Promise.all([
    prisma.setting.upsert({
      where: { key: 'twitterAuthToken' },
      create: { key: 'twitterAuthToken', value: authToken.trim() },
      update: { value: authToken.trim() },
    }),
    prisma.setting.upsert({
      where: { key: 'twitterCt0' },
      create: { key: 'twitterCt0', value: ct0.trim() },
      update: { value: ct0.trim() },
    }),
  ])

  return NextResponse.json({ success: true })
}

export async function DELETE() {
  await prisma.setting.deleteMany({
    where: { key: { in: ['twitterAuthToken', 'twitterCt0', 'twitterLastSync'] } },
  })
  return NextResponse.json({ success: true })
}
