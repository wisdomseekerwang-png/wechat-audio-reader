import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as cheerio from 'cheerio'

// ========== Types ==========
interface AccountConfig {
  id: string
  name: string
  sourceType: 'biz' | 'sogou'
  value: string
  enabled: boolean
  lastScanAt?: string
}

interface Article {
  id: string
  accountName: string
  title: string
  url: string
  summary: string
  content: string
  publishDate: string
  audioGenerated: boolean
  audioGenerating: boolean
  isRead: boolean
  sourceType?: string
}

// ========== UA Pool ==========
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/123.0.0.0 Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36',
]

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

// ========== Helpers ==========

function genId(): string {
  return `art_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function cleanHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, '')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractMatch(text: string, regex: RegExp, group = 1): string {
  const m = text.match(regex)
  return m ? m[group]?.trim() || '' : ''
}

async function fetchWithUA(url: string, extraHeaders: Record<string, string> = {}, timeout = 15000): Promise<Response | null> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        ...extraHeaders,
      },
      signal: controller.signal,
    })
    return res
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

async function fetchText(url: string, extraHeaders: Record<string, string> = {}, timeout = 15000): Promise<string | null> {
  const res = await fetchWithUA(url, extraHeaders, timeout)
  if (!res || !res.ok) return null
  return await res.text()
}

// ========== Sogou Cookie ==========

interface SogouCookie {
  cookieStr: string
  cookieObj: Record<string, string>
}

async function getSogouCookie(): Promise<SogouCookie> {
  try {
    const res = await fetchWithUA(
      'https://v.sogou.com/v?ie=utf8&query=&p=40030600',
      {},
      10000
    )
    if (!res) return { cookieStr: '', cookieObj: {} }

    const setCookieHeaders = res.headers.getSetCookie?.() || []
    const cookies: string[] = []
    const cookieObj: Record<string, string> = {}

    for (const cookie of setCookieHeaders) {
      const parts = cookie.split(';')[0].split('=')
      if (parts.length >= 2) {
        cookies.push(cookie.split(';')[0])
        cookieObj[parts[0].trim()] = parts[1].trim()
      }
    }

    return { cookieStr: cookies.join('; '), cookieObj }
  } catch {
    return { cookieStr: '', cookieObj: {} }
  }
}

// ========== Method 1: Scan by __biz (WeChat API) ==========

interface WechatArticleItem {
  title: string
  link: string
  create_time: number
  digest: string
  content_url: string
}

async function scanByBiz(biz: string): Promise<Article[]> {
  const url = `https://mp.weixin.qq.com/mp/profile_ext?action=home&__biz=${encodeURIComponent(biz)}&scene=124&devicetype=android-30&version=28003333&lang=zh_CN&nettype=WIFI&a8scene=3&pass_ticket=&wx_header=3`
  const html = await fetchText(url)
  if (!html) return []

  const msgMatch = html.match(/var\s+msgList\s*=\s*'({[\s\S]*?})'/)
  if (!msgMatch) return []

  try {
    const msgData = JSON.parse(msgMatch[1].replace(/&quot;/g, '"'))
    const list: WechatArticleItem[] = msgData.list || []

    return list
      .filter(item => item.title && item.link)
      .map(item => ({
        id: genId(),
        accountName: extractMatch(html, /var\s+nickname\s*=\s*['"]([^'"]+)['"]/) || '',
        title: cleanHtml(item.title),
        url: item.link,
        summary: cleanHtml(item.digest || '').substring(0, 200),
        content: '',
        publishDate: new Date((item.create_time || 0) * 1000).toISOString(),
        audioGenerated: false,
        audioGenerating: false,
        isRead: false,
        sourceType: 'biz',
      }))
  } catch {
    return []
  }
}

// ========== Method 2: Scan by Sogou search (wechat-article-search skill) ==========

function formatChinaDateTime(date: Date): string {
  return date.toISOString()
}

function parseSogouArticleTimestamp(scriptText: string): { datetime: string; timeDescription: string } {
  const timestampMatch = scriptText.match(/(\d{10})/)
  if (!timestampMatch) return { datetime: '', timeDescription: '' }

  const timestamp = parseInt(timestampMatch[1]) * 1000
  const articleDate = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - articleDate.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  let timeDescription = ''
  if (diffDays > 0) {
    timeDescription = `${diffDays}天前`
  } else if (diffHours > 0) {
    timeDescription = `${diffHours}小时前`
  } else {
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    timeDescription = diffMinutes > 0 ? `${diffMinutes}分钟前` : '刚刚'
  }

  return {
    datetime: articleDate.toISOString(),
    timeDescription,
  }
}

interface SogouArticleRaw {
  title: string
  url: string
  summary: string
  datetime: string
  timeDescription: string
  source: string
}

function parseSogouSearchHtml(html: string, maxResults: number): SogouArticleRaw[] {
  const articles: SogouArticleRaw[] = []
  const $ = cheerio.load(html)

  const $newsList = $('ul.news-list')
  if ($newsList.length === 0) return []

  $newsList.find('li').each((_, element) => {
    if (articles.length >= maxResults) return false

    const $elem = $(element)

    // Title & URL
    const $titleLink = $elem.find('h3 a')
    if ($titleLink.length === 0) return
    const title = $titleLink.text().trim()
    let url = $titleLink.attr('href') || ''
    if (url.startsWith('/')) {
      url = `https://weixin.sogou.com${url}`
    }

    // Summary
    const summary = $elem.find('p.txt-info').text().trim()

    // Date & Source
    let datetime = ''
    let timeDescription = ''
    let source = ''

    const $sourceBox = $elem.find('.s-p')
    if ($sourceBox.length > 0) {
      // Try timestamp from script tag
      const $dateScript = $sourceBox.find('.s2 script')
      if ($dateScript.length > 0) {
        const parsed = parseSogouArticleTimestamp($dateScript.text())
        datetime = parsed.datetime
        timeDescription = parsed.timeDescription
      }

      // Try text fallback
      if (!datetime) {
        const $timeElem = $sourceBox.find('.s2')
        if ($timeElem.length > 0) {
          const timeText = $timeElem.clone().children('script').remove().end().text().trim()
          if (timeText) {
            timeDescription = timeText
            const now = new Date()
            const dayMatch = timeText.match(/(\d+)天前/)
            const hourMatch = timeText.match(/(\d+)小时前/)
            const minuteMatch = timeText.match(/(\d+)分钟前/)
            if (dayMatch) {
              const d = new Date(now)
              d.setDate(d.getDate() - parseInt(dayMatch[1]))
              datetime = d.toISOString()
            } else if (hourMatch) {
              const d = new Date(now)
              d.setHours(d.getHours() - parseInt(hourMatch[1]))
              datetime = d.toISOString()
            } else if (minuteMatch) {
              const d = new Date(now)
              d.setMinutes(d.getMinutes() - parseInt(minuteMatch[1]))
              datetime = d.toISOString()
            }
          }
        }
      }

      // Source account name
      const $sourceSpan = $sourceBox.find('.all-time-y2')
      const $sourceLink = $sourceBox.find('a.account')
      if ($sourceSpan.length > 0) {
        source = $sourceSpan.text().trim()
      } else if ($sourceLink.length > 0) {
        source = $sourceLink.text().trim()
      }
    }

    if (!title) return

    articles.push({
      title,
      url,
      summary,
      datetime: datetime || new Date().toISOString(),
      timeDescription,
      source,
    })
  })

  return articles
}

async function scanBySogou(accountName: string, maxResults = 20): Promise<Article[]> {
  // 1. Get Sogou cookie
  const { cookieStr } = await getSogouCookie()

  const allRaw: SogouArticleRaw[] = []
  let page = 1
  const maxPages = Math.ceil(maxResults / 10)

  while (allRaw.length < maxResults && page <= maxPages) {
    const encodedQuery = encodeURIComponent(accountName)
    const searchUrl = `https://weixin.sogou.com/weixin?query=${encodedQuery}&s_from=input&_sug_=n&type=2&page=${page}&ie=utf8`

    const html = await fetchText(searchUrl, {
      'Cookie': cookieStr,
      'Host': 'weixin.sogou.com',
      'Referer': 'https://weixin.sogou.com/',
      'Accept-Encoding': 'identity', // prevent gzip to avoid decode issues
    }, 20000)

    if (!html) break

    const remaining = maxResults - allRaw.length
    const parsed = parseSogouSearchHtml(html, remaining)
    if (parsed.length === 0) break

    allRaw.push(...parsed)
    page++

    if (page <= maxPages) {
      await sleep(500 + Math.random() * 1000)
    }
  }

  // Filter to articles where source matches accountName (fuzzy)
  const matched = allRaw.filter(a => {
    if (!a.source) return true // if no source info, include it
    return a.source.includes(accountName) || accountName.includes(a.source)
  })

  // If no exact match, return all results (account might not have source field)
  const results = matched.length > 0 ? matched : allRaw

  return results.slice(0, maxResults).map(raw => ({
    id: genId(),
    accountName: raw.source || accountName,
    title: raw.title,
    url: raw.url,
    summary: raw.summary.substring(0, 200),
    content: '',
    publishDate: raw.datetime,
    audioGenerated: false,
    audioGenerating: false,
    isRead: false,
    sourceType: 'sogou',
  }))
}

// ========== Method 3: Fetch article content by URL ==========

export async function fetchArticleContent(articleUrl: string): Promise<{
  title: string
  content: string
  accountName: string
} | null> {
  const html = await fetchText(articleUrl)
  if (!html) return null

  const title =
    extractMatch(html, /<meta\s+property="og:title"\s+content="([^"]*)"/i) ||
    extractMatch(html, /<title>([^<]+)<\/title>/i) ||
    ''

  const accountName =
    extractMatch(html, /<meta\s+property="og:article:author"\s+content="([^"]*)"/i) ||
    extractMatch(html, /id="js_name"[^>]*>([^<]+)</i) ||
    extractMatch(html, /class="rich_media_meta_nickname"[^>]*>([^<]+)</i) ||
    ''

  const contentMatch = html.match(/id="js_content"[^>]*>([\s\S]*?)<\/div>/i)
  const rawContent = contentMatch ? contentMatch[1] : html
  const content = cleanHtml(rawContent)

  return {
    title: cleanHtml(title),
    content: content.substring(0, 10000),
    accountName: cleanHtml(accountName),
  }
}

// ========== Main handler ==========

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // GET /api/scan?mode=fetch&url=...  – fetch single article
    if (req.method === 'GET') {
      const mode = req.query.mode as string
      if (mode === 'fetch') {
        const url = req.query.url as string
        if (!url) return res.status(400).json({ error: 'url param required' })
        const article = await fetchArticleContent(url)
        if (!article) return res.status(404).json({ error: 'Failed to fetch article' })
        return res.json({
          article: {
            id: genId(),
            accountName: article.accountName,
            title: article.title,
            url,
            summary: article.content.substring(0, 200),
            content: article.content,
            publishDate: new Date().toISOString(),
            audioGenerated: false,
            audioGenerating: false,
            isRead: false,
            sourceType: 'url',
          },
        })
      }
      return res.status(400).json({ error: 'Unknown mode' })
    }

    // POST /api/scan – scan accounts
    const body = req.body || {}
    const accounts: AccountConfig[] = body.accounts || (body.account ? [body.account] : [])

    if (accounts.length === 0) {
      return res.status(400).json({ error: 'No accounts provided' })
    }

    const allArticles: Article[] = []

    for (const account of accounts) {
      if (!account.sourceType || !account.value) continue

      let articles: Article[] = []

      if (account.sourceType === 'biz') {
        articles = await scanByBiz(account.value)
      } else if (account.sourceType === 'sogou') {
        articles = await scanBySogou(account.value)
      }

      // Override accountName with the configured name
      for (const a of articles) {
        a.accountName = account.name || a.accountName
      }

      allArticles.push(...articles)
    }

    return res.json({ articles: allArticles })
  } catch (error: any) {
    console.error('Scan error:', error)
    return res.status(500).json({ error: error.message || 'Scan failed' })
  }
}
