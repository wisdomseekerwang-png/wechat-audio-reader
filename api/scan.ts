import type { VercelRequest, VercelResponse } from '@vercel/node'

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

// ========== Helpers ==========

function genId(): string {
  return `art_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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

async function fetchWithUA(url: string, timeout = 15000): Promise<string | null> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(t)
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
  const html = await fetchWithUA(url)
  if (!html) return []

  // Extract msgList JSON
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
        content: '', // populated later via fetch-article
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

// ========== Method 2: Scan by Sogou search ==========

async function scanBySogou(accountName: string): Promise<Article[]> {
  const searchUrl = `https://weixin.sogou.com/weixin?type=2&query=${encodeURIComponent(accountName)}&ie=utf8`
  const html = await fetchWithUA(searchUrl)
  if (!html) return []

  const articles: Article[] = []

  // Parse Sogou WeChat article list items
  const itemRegex = /<li[^>]*class="[^"]*news-item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi
  let match

  while ((match = itemRegex.exec(html)) !== null) {
    const itemHtml = match[1]

    // Extract title and link
    const linkMatch = itemHtml.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i)
    if (!linkMatch) continue

    let articleUrl = linkMatch[1].replace(/&amp;/g, '&')
    const title = cleanHtml(linkMatch[2])

    // Extract digest
    const digest = cleanHtml(
      extractMatch(itemHtml, /<p[^>]*class="[^"]*txt-info[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
      extractMatch(itemHtml, /<dd[^>]*>([\s\S]*?)<\/dd>/i)
    )

    // Extract date
    const dateStr = extractMatch(itemHtml, /<span[^>]*class="[^"]*s2[^"]*"[^>]*>([^<]+)<\/span>/i)
    const publishDate = parseDate(dateStr)

    if (!title) continue

    articles.push({
      id: genId(),
      accountName,
      title,
      url: articleUrl,
      summary: digest.substring(0, 200),
      content: '', // populated later
      publishDate: publishDate || new Date().toISOString(),
      audioGenerated: false,
      audioGenerating: false,
      isRead: false,
      sourceType: 'sogou',
    })
  }

  return articles
}

function parseDate(str: string): string | null {
  if (!str) return null
  // Try various Chinese date formats
  const now = new Date()
  const year = now.getFullYear()

  // "5月26日" or "05月26日"
  const mmdd = str.match(/(\d{1,2})月(\d{1,2})日/)
  if (mmdd) {
    return new Date(year, parseInt(mmdd[1]) - 1, parseInt(mmdd[2])).toISOString()
  }

  // "今天" or "昨天"
  if (str.includes('今天')) return now.toISOString()
  if (str.includes('昨天')) {
    const d = new Date(now)
    d.setDate(d.getDate() - 1)
    return d.toISOString()
  }

  // ISO date
  const d = new Date(str)
  if (!isNaN(d.getTime())) return d.toISOString()

  return null
}

// ========== Method 3: Fetch article content by URL ==========

export async function fetchArticleContent(articleUrl: string): Promise<{
  title: string
  content: string
  accountName: string
} | null> {
  const html = await fetchWithUA(articleUrl)
  if (!html) return null

  // Try WeChat article page
  const title =
    extractMatch(html, /<meta\s+property="og:title"\s+content="([^"]*)"/i) ||
    extractMatch(html, /<title>([^<]+)<\/title>/i) ||
    ''

  const accountName =
    extractMatch(html, /<meta\s+property="og:article:author"\s+content="([^"]*)"/i) ||
    extractMatch(html, /id="js_name"[^>]*>([^<]+)</i) ||
    extractMatch(html, /class="rich_media_meta_nickname"[^>]*>([^<]+)</i) ||
    ''

  // Extract rich_media_content
  const contentMatch = html.match(/id="js_content"[^>]*>([\s\S]*?)<\/div>/i)
  const rawContent = contentMatch ? contentMatch[1] : html
  const content = cleanHtml(rawContent)

  return {
    title: cleanHtml(title),
    content: content.substring(0, 10000), // limit
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
