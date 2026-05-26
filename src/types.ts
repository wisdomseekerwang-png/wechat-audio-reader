export type AccountSourceType = 'sogou' | 'bing' | 'archive'

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
  sourceType?: AccountSourceType | 'url'
}

export interface AccountConfig {
  id: string
  name: string
  /** Source type: 'sogou' = Sogou search, 'bing' = Bing search, 'archive' = archive/mirror site */
  sourceType: AccountSourceType
  /** Value: account name for search, or archive site URL for 'archive' type */
  value: string
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
