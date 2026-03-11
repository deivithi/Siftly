import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getCliAuthStatus, getCliAvailability } from '@/lib/claude-cli-auth'
import { getCodexCliAuthStatus } from '@/lib/openai-auth'

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(await getCliAuthStatus())
}
