import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as cheerio from 'cheerio'

// ========== Types ==========
interface AccountConfig {
  id: string
  name: string
  value: string
  archiveUrl?: string
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
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/123.0.0.0 Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/122.0.0.0 Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; Mi 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
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

// ========== Scan by Sogou search (wechat-article-search skill) ==========

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
    // tsn=3 requests newest-first ordering from Sogou
    const searchUrl = `https://weixin.sogou.com/weixin?query=${encodedQuery}&_sug_=n&_sug_type_=&type=2&page=${page}&ie=utf8&tsn=3`

    const html = await fetchText(searchUrl, {
      'Cookie': cookieStr,
      'Host': 'weixin.sogou.com',
      'Referer': 'https://weixin.sogou.com/',
      'Accept-Encoding': 'identity',
    }, 20000)

    if (!html) break

    const remaining = maxResults - allRaw.length
    const parsed = parseSogouSearchHtml(html, remaining)
    if (parsed.length === 0) break

    allRaw.push(...parsed)
    page++

    if (page <= maxPages) {
      await sleep(800 + Math.random() * 1200)
    }
  }

  // Filter to articles where source matches accountName (fuzzy)
  const matched = allRaw.filter(a => {
    if (!a.source) return false
    return a.source.includes(accountName) || accountName.includes(a.source)
  })

  const results = (matched.length > 0 ? matched : allRaw)
    // Sort by date descending (newest first)
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())
    // Filter: only articles from last 30 days
    .filter(a => {
      const d = new Date(a.datetime)
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
      return d.getTime() > thirtyDaysAgo
    })

  if (results.length === 0) return []

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

// ========== Scan by Bing search (site:mp.weixin.qq.com backup source) ==========

interface BingArticleRaw {
  title: string
  url: string
  summary: string
  datetime: string
  timeDescription: string
  source: string
}

function parseBingSearchHtml(html: string, maxResults: number): BingArticleRaw[] {
  const articles: BingArticleRaw[] = []
  const $ = cheerio.load(html)

  // Bing search result items
  const $results = $('li.b_algo, ol#b_results > li.b_algo')

  $results.each((_, element) => {
    if (articles.length >= maxResults) return false

    const $elem = $(element)

    // Title & URL
    const $titleLink = $elem.find('h2 a')
    if ($titleLink.length === 0) return
    const title = $titleLink.text().trim()
    const url = $titleLink.attr('href') || ''
    if (!url.includes('mp.weixin.qq.com')) return

    // Summary
    const summary = $elem.find('.b_caption p, .b_lineclamp2, .b_algoSlug').first().text().trim()

    // Date - Bing shows date in various formats
    let datetime = ''
    let timeDescription = ''
    const $dateMeta = $elem.find('.news_dt, .news_hassource time, .b_srt')
    if ($dateMeta.length > 0) {
      const dateText = $dateMeta.text().trim()
      timeDescription = dateText
      // Try parsing: "X days ago", "X小时前", etc.
      const parsed = parseRelativeDate(dateText)
      datetime = parsed.datetime
      if (!parsed.timeDescription) {
        timeDescription = dateText
      } else {
        timeDescription = parsed.timeDescription
      }
    }

    // Source - try to extract account name from URL or description
    let source = ''
    // WeChat article URLs contain __biz which can identify the account
    const bizMatch = url.match(/__biz=([^&]+)/)
    if (bizMatch) {
      source = bizMatch[1]
    }

    // Try to get account name from the snippet if it mentions a 公众号
    const $sourceEl = $elem.find('.news_source, .b_attribution')
    if ($sourceEl.length > 0) {
      const sourceText = $sourceEl.text().trim()
      if (sourceText && sourceText.length < 50) {
        source = sourceText
      }
    }

    if (!title || !url) return

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

function parseRelativeDate(dateText: string): { datetime: string; timeDescription: string } {
  if (!dateText) return { datetime: '', timeDescription: '' }

  // Chinese relative time
  const dayMatch = dateText.match(/(\d+)天前/)
  const hourMatch = dateText.match(/(\d+)小时前/)
  const minuteMatch = dateText.match(/(\d+)分钟前/)
  const justNow = dateText.match(/刚刚|1分钟内/)

  const now = new Date()
  let targetDate = new Date(now)

  if (dayMatch) {
    const days = parseInt(dayMatch[1])
    targetDate.setDate(now.getDate() - days)
    return { datetime: targetDate.toISOString(), timeDescription: `${days}天前` }
  }
  if (hourMatch) {
    const hours = parseInt(hourMatch[1])
    targetDate.setHours(now.getHours() - hours)
    return { datetime: targetDate.toISOString(), timeDescription: `${hours}小时前` }
  }
  if (minuteMatch) {
    const minutes = parseInt(minuteMatch[1])
    targetDate.setMinutes(now.getMinutes() - minutes)
    return { datetime: targetDate.toISOString(), timeDescription: `${minutes}分钟前` }
  }
  if (justNow) {
    return { datetime: now.toISOString(), timeDescription: '刚刚' }
  }

  // English relative time
  const enDayMatch = dateText.match(/(\d+)\s*days?\s*ago/i)
  const enHourMatch = dateText.match(/(\d+)\s*hours?\s*ago/i)
  const enMinMatch = dateText.match(/(\d+)\s*mins?\s*ago/i)

  if (enDayMatch) {
    const days = parseInt(enDayMatch[1])
    targetDate.setDate(now.getDate() - days)
    return { datetime: targetDate.toISOString(), timeDescription: `${days}天前` }
  }
  if (enHourMatch) {
    const hours = parseInt(enHourMatch[1])
    targetDate.setHours(now.getHours() - hours)
    return { datetime: targetDate.toISOString(), timeDescription: `${hours}小时前` }
  }
  if (enMinMatch) {
    return { datetime: now.toISOString(), timeDescription: '刚刚' }
  }

  // Try standard date formats
  const isoMatch = dateText.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    const d = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00+08:00`)
    return { datetime: d.toISOString(), timeDescription: isoMatch[0] }
  }

  return { datetime: now.toISOString(), timeDescription: dateText }
}

async function scanByBing(accountName: string, maxResults = 20): Promise<Article[]> {
  const allRaw: BingArticleRaw[] = []
  let first = 1

  while (allRaw.length < maxResults) {
    const query = encodeURIComponent(`site:mp.weixin.qq.com ${accountName}`)
    const searchUrl = `https://www.bing.com/search?q=${query}&first=${first}&setlang=zh-cn&cc=cn`

    const html = await fetchText(searchUrl, {
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Referer': 'https://www.bing.com/',
    }, 20000)

    if (!html) break

    const remaining = maxResults - allRaw.length
    const parsed = parseBingSearchHtml(html, remaining)
    if (parsed.length === 0) break

    allRaw.push(...parsed)
    first += 10

    if (first > 30) break // Max 3 pages (30 results)

    // Random delay 1-2 seconds between pages
    await sleep(1000 + Math.random() * 1000)
  }

  // Sort by date descending
  const sorted = allRaw.sort((a, b) =>
    new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
  )

  // Filter: only articles from last 30 days
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const recent = sorted.filter(a => new Date(a.datetime).getTime() > thirtyDaysAgo)

  if (recent.length === 0) return []

  return recent.slice(0, maxResults).map(raw => ({
    id: genId(),
    accountName,
    title: raw.title,
    url: raw.url,
    summary: raw.summary.substring(0, 200),
    content: '',
    publishDate: raw.datetime,
    audioGenerated: false,
    audioGenerating: false,
    isRead: false,
    sourceType: 'bing',
  }))
}

// ========== Scan by Archive/Mirror Sites (direct homepage scraping) ==========
// Inspired by fetch_articles_tts.py: maobidao.cn, fugay.com, etc.

const NAV_SKIP_KEYWORDS = [
  '导航', '搜索', '首页', '登录', '注册', '评论', '回复', '发表评论',
  '上页', '下页', '目录', '下载', '关于', '联系', 'RSS', 'rss',
  'admin', 'login', 'logout', 'signin', 'signup', 'register',
  'wp-', 'feed', 'tag/', 'category/', 'page/', 'author/',
  '#respond', '#comment', '#comments', 'javascript:',
]

function looksLikeArticleUrl(url: string, title: string): boolean {
  if (!url || url.startsWith('#') || url.startsWith('javascript:')) return false
  if (!title || title.length < 3) return false

  // Skip nav/meta links
  const lowerTitle = title.toLowerCase()
  const lowerUrl = url.toLowerCase()
  for (const kw of NAV_SKIP_KEYWORDS) {
    if (lowerTitle.includes(kw)) return false
    if (lowerUrl.includes(kw)) return false
  }

  return true
}

interface ArchiveArticleLink {
  title: string
  url: string
  position: number // lower = higher on page = likely newer
}

function parseArchiveHomepage(html: string, homepageUrl: string, maxResults: number): ArchiveArticleLink[] {
  const $ = cheerio.load(html)
  const links: ArchiveArticleLink[] = []
  let position = 0

  const baseUrl = (() => {
    try {
      const u = new URL(homepageUrl)
      return u.origin
    } catch { return homepageUrl }
  })()

  $('a[href]').each((_, el) => {
    const $el = $(el)
    const title = $el.text().trim()
    const rawHref = ($el.attr('href') || '').trim()

    if (!looksLikeArticleUrl(rawHref, title)) return

    // Resolve relative URLs
    let url = rawHref
    try {
      url = new URL(rawHref, baseUrl).href
    } catch {
      url = baseUrl.replace(/\/$/, '') + '/' + rawHref.replace(/^\//, '')
    }

    // Skip if it resolves back to the homepage itself
    if (url === homepageUrl || url === homepageUrl + '/') return

    links.push({ title, url, position })
    position++
  })

  // Deduplicate by URL
  const seen = new Set<string>()
  const unique = links.filter(l => {
    if (seen.has(l.url)) return false
    seen.add(l.url)
    return true
  })

  // Sort by position (higher on page first) = likely newer
  return unique
    .sort((a, b) => a.position - b.position)
    .slice(0, maxResults)
}

async function scanByArchive(homepageUrl: string, maxResults = 10): Promise<Article[]> {
  // Fetch homepage
  const html = await fetchText(homepageUrl, {
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  }, 20000)

  if (!html) return []

  const links = parseArchiveHomepage(html, homepageUrl, maxResults)
  if (links.length === 0) return []

  const articles: Article[] = []
  for (const link of links) {
    // Try to fetch article content from the archive page
    const content = await fetchArchiveContent(link.url)
    const now = new Date().toISOString()

    articles.push({
      id: genId(),
      accountName: '',
      title: link.title,
      url: link.url,
      summary: content ? content.substring(0, 200) : link.title,
      content: content || '',
      publishDate: now,
      audioGenerated: false,
      audioGenerating: false,
      isRead: false,
      sourceType: 'archive',
    })

    // Small delay between article fetches
    if (articles.length < links.length) {
      await sleep(300 + Math.random() * 500)
    }
  }

  return articles
}

// ========== Scan by Archive Date-Pattern URL ==========
// For sites like fugay.com: https://www.fugay.com/{YYYY}/{MM}/{DD}-lbjs/

function hasDatePlaceholders(url: string): boolean {
  return /\{YYYY\}|\{MM\}|\{DD\}/.test(url)
}

function resolveDateUrl(pattern: string, date: Date): string {
  const yyyy = date.getFullYear().toString()
  const mm = (date.getMonth() + 1).toString().padStart(2, '0')
  const dd = date.getDate().toString().padStart(2, '0')
  return pattern
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{MM\}/g, mm)
    .replace(/\{DD\}/g, dd)
}

async function scanByArchiveDate(dateUrlPattern: string, accountName: string, maxDays = 7, maxResults = 5): Promise<Article[]> {
  const articles: Article[] = []
  const today = new Date()

  for (let i = 0; i < maxDays; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const url = resolveDateUrl(dateUrlPattern, date)

    const html = await fetchText(url, {
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    }, 15000)

    if (!html || html.length < 3000) continue

    // Extract title from <title> tag
    let title = ''
    const $ = cheerio.load(html)
    const titleText = $('title').text().trim()
    if (titleText) {
      // Clean up: remove site name suffix like " | 刘备教授"
      title = titleText.split(/\s*[|]\s*/)[0].trim()
      if (!title) title = titleText.trim()
    }

    if (!title) {
      // Fallback: use first h1 or strong heading
      title = $('h1').first().text().trim() || $('h2').first().text().trim()
    }

    if (!title || title.length < 2) continue

    // Fetch content from this archive page (not mp.weixin.qq.com)
    const content = await fetchArchiveContent(url)

    articles.push({
      id: genId(),
      accountName,
      title,
      url,
      summary: content ? content.substring(0, 200) : title,
      content: content || '',
      publishDate: date.toISOString(),
      audioGenerated: false,
      audioGenerating: false,
      isRead: false,
      sourceType: 'archive',
    })

    if (articles.length >= maxResults) break

    // Small delay
    await sleep(200 + Math.random() * 300)
  }

  return articles
}

// ========== Fetch content from an archive/mirror site article page ==========
// Inspired by fetch_maobidao / fetch_fugay in fetch_articles_tts.py

async function fetchArchiveContent(articleUrl: string): Promise<string> {
  const html = await fetchText(articleUrl, {
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  }, 20000)

  if (!html) return ''

  const $ = cheerio.load(html)

  // Remove script, style, nav elements
  $('script, style, nav, footer, header, .sidebar, .comment, .nav').remove()

  // Strategy 1: Extract <p> tags (like maobidao / fugay)
  const $paragraphs = $('p')
  const textParts: string[] = []
  $paragraphs.each((_, el) => {
    const t = cleanHtml($(el).html() || $(el).text())
    if (t.length > 15) {
      textParts.push(t)
    }
  })

  if (textParts.length > 0) {
    return textParts.join('\n\n')
  }

  // Strategy 2: Extract <article> or <main> content
  const articleText = $('article, main, .content, .post-content, .entry-content')
    .text()
    .trim()
  if (articleText.length > 100) {
    return cleanHtml(articleText)
  }

  // Strategy 3: Full page body text extraction
  const bodyText = $('body').text().trim()
  if (bodyText.length > 100) {
    // Split into paragraphs by newlines and filter
    const lines = bodyText.split(/\n+/)
    const cleanLines = lines
      .map(l => l.trim())
      .filter(l => l.length > 15)
      .slice(0, 50)
    return cleanLines.join('\n\n')
  }

  return ''
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
      if (!account.value) continue

      let articles: Article[] = []

      // 1. Try Sogou first
      articles = await scanBySogou(account.value)

      // 2. If Sogou returned few results, supplement with Bing
      if (articles.length < 5) {
        const bingArticles = await scanByBing(account.value)
        // Merge, deduplicate by URL
        const existingUrls = new Set(articles.map(a => a.url))
        for (const ba of bingArticles) {
          if (!existingUrls.has(ba.url)) {
            articles.push(ba)
            existingUrls.add(ba.url)
          }
        }
      }

      // 3. If account has archiveUrl, also try archive scraping
      if (account.archiveUrl) {
        let archiveArticles: Article[] = []
        if (hasDatePlaceholders(account.archiveUrl)) {
          archiveArticles = await scanByArchiveDate(account.archiveUrl, account.name)
        } else {
          archiveArticles = await scanByArchive(account.archiveUrl)
        }
        // Merge archive results
        const existingUrls = new Set(articles.map(a => a.url))
        for (const aa of archiveArticles) {
          if (!existingUrls.has(aa.url)) {
            articles.push(aa)
          }
        }
      }

      // Sort all results by date descending
      articles.sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())

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
