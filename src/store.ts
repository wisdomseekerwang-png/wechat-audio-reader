import { openDB, IDBPDatabase } from 'idb'
import type { AccountConfig, Article, ScheduleConfig, AppState } from './types'

const DB_NAME = 'wechat-audio-reader'
const DB_VERSION = 1

let db: IDBPDatabase

async function getDB() {
  if (!db) {
    db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('accounts')) {
          db.createObjectStore('accounts', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('articles')) {
          const store = db.createObjectStore('articles', { keyPath: 'id' })
          store.createIndex('accountName', 'accountName')
          store.createIndex('publishDate', 'publishDate')
        }
        if (!db.objectStoreNames.contains('schedule')) {
          db.createObjectStore('schedule', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('audioBlobs')) {
          db.createObjectStore('audioBlobs', { keyPath: 'id' })
        }
      },
    })
  }
  return db
}

// --- Accounts ---
export async function getAccounts(): Promise<AccountConfig[]> {
  const db = await getDB()
  return await db.getAll('accounts')
}

export async function saveAccount(account: AccountConfig): Promise<void> {
  const db = await getDB()
  await db.put('accounts', account)
}

export async function deleteAccount(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('accounts', id)
}

// --- Articles ---
export async function getArticles(): Promise<Article[]> {
  const db = await getDB()
  const articles = await db.getAll('articles')
  return articles.sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())
}

export async function saveArticle(article: Article): Promise<void> {
  const db = await getDB()
  await db.put('articles', article)
}

export async function saveArticles(articles: Article[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('articles', 'readwrite')
  await Promise.all(articles.map(a => tx.store.put(a)))
  await tx.done
}

export async function deleteArticle(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('articles', id)
  // Also delete associated audio blob
  try {
    await db.delete('audioBlobs', id)
  } catch {}
}

// --- Audio Blobs ---
export async function getAudioBlob(id: string): Promise<Blob | null> {
  const db = await getDB()
  const entry = await db.get('audioBlobs', id)
  return entry?.blob ?? null
}

export async function saveAudioBlob(id: string, blob: Blob): Promise<void> {
  const db = await getDB()
  await db.put('audioBlobs', { id, blob })
}

// --- Schedule ---
export async function getSchedule(): Promise<ScheduleConfig> {
  const db = await getDB()
  const config = await db.get('schedule', 'main')
  return config ?? {
    id: 'main',
    scanHour: 8,
    scanMinute: 0,
    autoGenerateAudio: true,
    voice: 'zh-CN',
    rate: 1.0,
    volume: 1.0,
  }
}

export async function saveSchedule(config: ScheduleConfig): Promise<void> {
  const db = await getDB()
  await db.put('schedule', { ...config, id: 'main' })
}

// --- Full State ---
export async function loadState(): Promise<AppState> {
  const [accounts, articles, schedule] = await Promise.all([
    getAccounts(),
    getArticles(),
    getSchedule(),
  ])
  return {
    accounts,
    articles,
    schedule,
    playerQueue: articles.filter(a => a.audioGenerated && !a.isRead),
    currentPlayingId: null,
    isPlaying: false,
  }
}
