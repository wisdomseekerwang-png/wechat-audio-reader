export type ArticleSourceType = 'sogou' | 'bing' | 'archive' | 'url'

export interface Article {
  id: string
  accountName: string
  title: string
  url: string
  summary: string
  content: string
  publishDate: string
  audioUrl?: string
  audioGenerated: boolean
  audioGenerating: boolean
  isRead: boolean
  /** Which source actually provided this article (for display only) */
  sourceType?: ArticleSourceType
}

export interface AccountConfig {
  id: string
  name: string
  /** Account name for search (auto-tries sogou → bing) */
  value: string
  /** Optional archive/mirror site URL for this account */
  archiveUrl?: string
  enabled: boolean
  lastScanAt?: string
}

export interface ScheduleConfig {
  id?: string
  scanHour: number
  scanMinute: number
  autoGenerateAudio: boolean
  voice: string
  rate: number
  volume: number
}

export interface AppState {
  accounts: AccountConfig[]
  articles: Article[]
  schedule: ScheduleConfig
  playerQueue: Article[]
  currentPlayingId: string | null
  isPlaying: boolean
}

export type TabId = 'articles' | 'accounts' | 'settings'
