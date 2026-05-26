export type AccountSourceType = 'biz' | 'sogou'

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
  /** Source type: 'biz' = direct WeChat __biz, 'sogou' = search by name */
  sourceType: AccountSourceType
  /** Value: __biz for 'biz' type, account name for 'sogou' type */
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
