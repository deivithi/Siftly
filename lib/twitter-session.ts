import prisma from '@/lib/db'

const BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I%2BxMb1nYFAA%3DUognEfK4ZPxYowpr4nMskopkC%2FDO'

const FEATURES = JSON.stringify({
  graphql_timeline_v2_bookmark_timeline: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  tweetypie_unmention_optimization_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: false,
  tweet_awards_web_tipping_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_enhance_cards_enabled: false,
})

// Query ID for X's internal Bookmarks GraphQL endpoint.
// Update this value if you start getting 400 errors after an X deploy.
export const QUERY_ID = 'j5KExFXy1niL_uGnBhHNxA'

export interface XCredentials {
  authToken: string
  ct0: string
  twid?: string      // u%3D{userId} — ties session to user, critical for server-side auth
  guestId?: string   // guest_id — secondary session cookie
}

interface MediaVariant {
  content_type?: string
  bitrate?: number
  url?: string
}

interface MediaEntity {
  type?: string
  media_url_https?: string
  video_info?: { variants?: MediaVariant[] }
}

interface TweetLegacy {
  full_text?: string
  created_at?: string
  entities?: { hashtags?: unknown[]; urls?: unknown[]; media?: MediaEntity[] }
  extended_entities?: { media?: MediaEntity[] }
}

interface UserLegacy {
  screen_name?: string
  name?: string
}

export interface TweetResult {
  rest_id?: string
  legacy?: TweetLegacy
  core?: { user_results?: { result?: { legacy?: UserLegacy } } }
}

function buildCookieHeader(creds: XCredentials): string {
  const parts = [
    `auth_token=${creds.authToken}`,
    `ct0=${creds.ct0}`,
  ]
  if (creds.twid) parts.push(`twid=${creds.twid}`)
  if (creds.guestId) parts.push(`guest_id=${creds.guestId}`)
  return parts.join('; ')
}

export async function fetchPage(creds: XCredentials, cursor?: string) {
  const variables = JSON.stringify({
    count: 100,
    includePromotedContent: false,
    ...(cursor ? { cursor } : {}),
  })

  const url = `https://x.com/i/api/graphql/${QUERY_ID}/Bookmarks?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(FEATURES)}`

  const res = await fetch(url, {
    headers: {
      // Auth
      Authorization: `Bearer ${BEARER}`,
      'X-Csrf-Token': creds.ct0,
      Cookie: buildCookieHeader(creds),
      // X-specific session headers
      'X-Twitter-Auth-Type': 'OAuth2Session',
      'X-Twitter-Active-User': 'yes',
      'X-Twitter-Client-Language': 'en',
      // Browser fingerprint headers — critical for X to accept server-side requests
      'Origin': 'https://x.com',
      'Referer': 'https://x.com/i/bookmarks',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'cors',
      'sec-fetch-dest': 'empty',
      'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      // Standard browser headers
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'cache-control': 'no-cache',
      'pragma': 'no-cache',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`X API ${res.status}: ${text.slice(0, 400)}`)
  }

  return res.json()
}

export function parsePage(data: unknown): { tweets: TweetResult[]; nextCursor: string | null } {
  const instructions =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any)?.data?.bookmark_timeline_v2?.timeline?.instructions ?? []

  const tweets: TweetResult[] = []
  let nextCursor: string | null = null

  for (const instruction of instructions) {
    if (instruction.type !== 'TimelineAddEntries') continue
    for (const entry of instruction.entries ?? []) {
      const content = entry.content
      if (content?.entryType === 'TimelineTimelineItem') {
        const tweet: TweetResult = content?.itemContent?.tweet_results?.result
        if (tweet?.rest_id) tweets.push(tweet)
      } else if (
        content?.entryType === 'TimelineTimelineCursor' &&
        content?.cursorType === 'Bottom'
      ) {
        nextCursor = content.value ?? null
      }
    }
  }

  return { tweets, nextCursor }
}

function bestVideoUrl(variants: MediaVariant[]): string | null {
  const mp4 = variants
    .filter((v) => v.content_type === 'video/mp4' && v.url)
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))
  return mp4[0]?.url ?? null
}

export function extractMedia(tweet: TweetResult) {
  const entities =
    tweet.legacy?.extended_entities?.media ?? tweet.legacy?.entities?.media ?? []
  return entities
    .map((m) => {
      const thumb = m.media_url_https ?? ''
      if (m.type === 'video' || m.type === 'animated_gif') {
        const url = bestVideoUrl(m.video_info?.variants ?? []) ?? thumb
        if (!url) return null
        return { type: m.type === 'animated_gif' ? 'gif' : 'video', url, thumbnailUrl: thumb }
      }
      if (!thumb) return null
      return { type: 'photo' as const, url: thumb, thumbnailUrl: thumb }
    })
    .filter(Boolean) as { type: string; url: string; thumbnailUrl: string }[]
}

/**
 * Fetches all bookmarks from X and saves new ones to the database.
 */
export async function syncBookmarks(creds: XCredentials): Promise<{ imported: number; skipped: number }> {
  let imported = 0
  let skipped = 0
  let cursor: string | undefined

  while (true) {
    const data = await fetchPage(creds, cursor)
    const { tweets, nextCursor } = parsePage(data)

    for (const tweet of tweets) {
      if (!tweet.rest_id) continue

      const exists = await prisma.bookmark.findUnique({
        where: { tweetId: tweet.rest_id },
        select: { id: true },
      })

      if (exists) {
        skipped++
        continue
      }

      const media = extractMedia(tweet)
      const userLegacy = tweet.core?.user_results?.result?.legacy ?? {}

      const created = await prisma.bookmark.create({
        data: {
          tweetId: tweet.rest_id,
          text: tweet.legacy?.full_text ?? '',
          authorHandle: userLegacy.screen_name ?? 'unknown',
          authorName: userLegacy.name ?? 'Unknown',
          tweetCreatedAt: tweet.legacy?.created_at
            ? new Date(tweet.legacy.created_at)
            : null,
          rawJson: JSON.stringify(tweet),
        },
      })

      if (media.length > 0) {
        await prisma.mediaItem.createMany({
          data: media.map((m) => ({
            bookmarkId: created.id,
            type: m.type,
            url: m.url,
            thumbnailUrl: m.thumbnailUrl ?? null,
          })),
        })
      }

      imported++
    }

    if (!nextCursor || tweets.length === 0) break
    cursor = nextCursor
  }

  return { imported, skipped }
}

/**
 * Reads all stored X credentials from the database.
 */
export async function getStoredCredentials(): Promise<XCredentials | null> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['twitterAuthToken', 'twitterCt0', 'twitterTwid', 'twitterGuestId'] } },
  })
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))

  if (!map.twitterAuthToken || !map.twitterCt0) return null

  return {
    authToken: map.twitterAuthToken,
    ct0: map.twitterCt0,
    twid: map.twitterTwid,
    guestId: map.twitterGuestId,
  }
}

/**
 * Validates credentials by attempting to fetch a single page of bookmarks.
 * Returns null on success, error message on failure.
 */
export async function testCredentials(creds: XCredentials): Promise<string | null> {
  try {
    const data = await fetchPage(creds)
    const { tweets } = parsePage(data)
    // If we get here without error, auth is working
    void tweets // suppress unused var warning
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Falha ao conectar'
  }
}
