import type { VercelRequest, VercelResponse } from '@vercel/node'

// RSSHub public instances
const RSSHUB_INSTANCES = [
  'https://rsshub.app',
  'https://rsshub.pseudoyu.com',
  'https://rsshub.rssforever.com',
]

interface AccountConfig {
  id: string
  name: string
  url: string
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
}

async function fetchRSS(url: string): Promise<string | null> {
  for (const base of RSSHUB_INSTANCES) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      const response = await fetch(url, {
        headers: { 'User-Agent': 'WeChatAudioReader/1.0' },
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (response.ok) {
        return await response.text()
      }
    } catch {
      continue
    }
  }
  return null
}

function parseRSS(xml: string, accountName: string): Article[] {
  const articles: Article[] = []

  // Simple XML parsing for RSS items
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1]
    const title = extractTag(item, 'title')
    const link = extractTag(item, 'link')
    const description = extractTag(item, 'description')
    const pubDate = extractTag(item, 'pubDate')

    if (!title || !link) continue

    const content = description
      ? description.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim()
      : ''

    articles.push({
      id: `art_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      accountName,
      title,
      url: link,
      summary: content.substring(0, 200),
      content,
      publishDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      audioGenerated: false,
      audioGenerating: false,
      isRead: false,
    })
  }

  return articles
}

function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i')
  const match = xml.match(regex)
  if (!match) return ''
  // Handle CDATA
  const cdata = match[1].match(/<!\[CDATA\[([\s\S]*?)\]\]>/)
  return cdata ? cdata[1].trim() : match[1].trim()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = req.body
    const accounts: AccountConfig[] = body.accounts || (body.account ? [body.account] : [])

    if (accounts.length === 0) {
      return res.status(400).json({ error: 'No accounts provided' })
    }

    const allArticles: Article[] = []

    for (const account of accounts) {
      if (!account.url) continue

      const xml = await fetchRSS(account.url)
      if (xml) {
        const articles = parseRSS(xml, account.name)
        allArticles.push(...articles)
      }
    }

    return res.json({ articles: allArticles })
  } catch (error: any) {
    console.error('Scan error:', error)
    return res.status(500).json({ error: error.message })
  }
}
