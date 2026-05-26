import type { Article, AccountConfig } from './types'

const API_BASE = '/api'

async function fetcher<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, options)
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function scanAccount(account: AccountConfig): Promise<Article[]> {
  const result = await fetcher<{ articles: Article[] }>('/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account }),
  })
  return result.articles
}

export async function generateAudio(articleId: string, text: string): Promise<{ audioUrl: string }> {
  const result = await fetcher<{ audioUrl: string }>('/generate-audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ articleId, text }),
  })
  return result
}

export async function scanAllAccounts(accounts: AccountConfig[]): Promise<Article[]> {
  const result = await fetcher<{ articles: Article[] }>('/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accounts }),
  })
  return result.articles
}
