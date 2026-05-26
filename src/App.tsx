import React, { useState, useCallback, useEffect } from 'react'
import type { TabId, AppState, AccountConfig, Article, ScheduleConfig } from './types'
import * as Store from './store'
import * as API from './api'
import AccountConfigPanel from './components/AccountConfigPanel'
import ArticleList from './components/ArticleList'
import AudioPlayer from './components/AudioPlayer'
import SettingsPanel from './components/SettingsPanel'

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    accounts: [],
    articles: [],
    schedule: { scanHour: 8, scanMinute: 0, autoGenerateAudio: true, voice: 'zh-CN', rate: 1.0, volume: 1.0 },
    playerQueue: [],
    currentPlayingId: null,
    isPlaying: false,
  })
  const [activeTab, setActiveTab] = useState<TabId>('articles')
  const [scanning, setScanning] = useState(false)
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [fetchingUrl, setFetchingUrl] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)

  useEffect(() => {
    Store.loadState().then(setState)
  }, [])

  const showMessage = useCallback((msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3000)
  }, [])

  // --- Accounts ---
  const handleSaveAccount = useCallback(async (account: AccountConfig) => {
    await Store.saveAccount(account)
    setState(prev => ({
      ...prev,
      accounts: prev.accounts.some(a => a.id === account.id)
        ? prev.accounts.map(a => a.id === account.id ? account : a)
        : [...prev.accounts, account],
    }))
    showMessage('公众号配置已保存')
  }, [showMessage])

  const handleDeleteAccount = useCallback(async (id: string) => {
    await Store.deleteAccount(id)
    setState(prev => ({
      ...prev,
      accounts: prev.accounts.filter(a => a.id !== id),
    }))
    showMessage('已删除')
  }, [showMessage])

  // --- Scanning ---
  const handleScan = useCallback(async (account?: AccountConfig) => {
    setScanning(true)
    try {
      const accountsToScan = account ? [account] : state.accounts.filter(a => a.enabled)
      if (accountsToScan.length === 0) {
        showMessage('没有已启用的公众号')
        return
      }
      const newArticles = await API.scanAllAccounts(accountsToScan)
      if (newArticles.length === 0) {
        showMessage('没有新文章')
        return
      }
      // Deduplicate by URL
      const existingUrls = new Set(state.articles.map(a => a.url))
      const uniqueNew = newArticles.filter(a => !existingUrls.has(a.url))
      
      await Store.saveArticles(uniqueNew)
      
      // Update lastScanAt
      for (const acc of accountsToScan) {
        await Store.saveAccount({ ...acc, lastScanAt: new Date().toISOString() })
      }
      
      setState(prev => ({
        ...prev,
        articles: [...uniqueNew, ...prev.articles],
        accounts: prev.accounts.map(a => {
          const scanned = accountsToScan.find(s => s.id === a.id)
          return scanned ? { ...a, lastScanAt: new Date().toISOString() } : a
        }),
      }))
      showMessage(`扫描完成，发现 ${uniqueNew.length} 篇新文章`)
    } catch (e: any) {
      showMessage(`扫描失败: ${e.message}`)
    } finally {
      setScanning(false)
    }
  }, [state.accounts, state.articles, showMessage])

  // --- Audio Generation ---
  const handleGenerateAudio = useCallback(async (article: Article) => {
    setGeneratingIds(prev => new Set(prev).add(article.id))
    // Update article state to generating
    setState(prev => ({
      ...prev,
      articles: prev.articles.map(a =>
        a.id === article.id ? { ...a, audioGenerating: true } : a
      ),
    }))
    try {
      const { audioUrl } = await API.generateAudio(article.id, article.content)
      const updatedArticle = { ...article, audioUrl, audioGenerated: true, audioGenerating: false }
      await Store.saveArticle(updatedArticle)
      setState(prev => ({
        ...prev,
        articles: prev.articles.map(a => a.id === article.id ? updatedArticle : a),
      }))
    } catch (e: any) {
      showMessage(`音频生成失败: ${e.message}`)
      setState(prev => ({
        ...prev,
        articles: prev.articles.map(a =>
          a.id === article.id ? { ...a, audioGenerating: false } : a
        ),
      }))
    } finally {
      setGeneratingIds(prev => {
        const next = new Set(prev)
        next.delete(article.id)
        return next
      })
    }
  }, [showMessage])

  // --- Article detail ---
  const handleArticleClick = useCallback((article: Article) => {
    setSelectedArticle(article)
  }, [])

  // --- Fetch article by URL ---
  const handleFetchArticle = useCallback(async (articleUrl: string) => {
    setFetchingUrl(true)
    try {
      const article = await API.fetchArticleByUrl(articleUrl)
      // Deduplicate
      const existing = state.articles.find(a => a.url === article.url)
      if (existing) {
        showMessage('该文章已存在')
        return
      }
      await Store.saveArticles([article])
      setState(prev => ({
        ...prev,
        articles: [article, ...prev.articles],
      }))
      showMessage(`已获取: ${article.title}`)
    } catch (e: any) {
      showMessage(`获取失败: ${e.message}`)
    } finally {
      setFetchingUrl(false)
    }
  }, [state.articles, showMessage])

  const handleDeleteArticle = useCallback(async (id: string) => {
    await Store.deleteArticle(id)
    setState(prev => ({
      ...prev,
      articles: prev.articles.filter(a => a.id !== id),
      playerQueue: prev.playerQueue.filter(a => a.id !== id),
      currentPlayingId: prev.currentPlayingId === id ? null : prev.currentPlayingId,
    }))
  }, [])

  // --- Schedule ---
  const handleSaveSchedule = useCallback(async (schedule: ScheduleConfig) => {
    await Store.saveSchedule(schedule)
    setState(prev => ({ ...prev, schedule }))
    showMessage('定时设置已保存')
  }, [showMessage])

  // --- Player ---
  const handleAddToQueue = useCallback((article: Article) => {
    setState(prev => {
      if (prev.playerQueue.some(a => a.id === article.id)) return prev
      return { ...prev, playerQueue: [...prev.playerQueue, article] }
    })
  }, [])

  const handleRemoveFromQueue = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      playerQueue: prev.playerQueue.filter(a => a.id !== id),
      currentPlayingId: prev.currentPlayingId === id ? null : prev.currentPlayingId,
      isPlaying: prev.currentPlayingId === id ? false : prev.isPlaying,
    }))
  }, [])

  const handleQueueChange = useCallback((queue: Article[]) => {
    setState(prev => ({ ...prev, playerQueue: queue }))
  }, [])

  const handlePlayingChange = useCallback((id: string | null, playing: boolean) => {
    setState(prev => ({
      ...prev,
      currentPlayingId: id,
      isPlaying: playing,
      articles: id
        ? prev.articles.map(a => a.id === id ? { ...a, isRead: true } : a)
        : prev.articles,
    }))
  }, [])

  // --- Tabs ---
  const tabs: { id: TabId; label: string }[] = [
    { id: 'articles', label: '文章列表' },
    { id: 'accounts', label: '公众号管理' },
    { id: 'settings', label: '定时设置' },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0d1b2a 100%)',
      color: '#e0e0e0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Header */}
      <header style={{
        padding: '20px 24px',
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>🎧</span>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, background: 'linear-gradient(135deg, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            公众号音频播报
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 20px',
                borderRadius: 8,
                border: '1px solid',
                borderColor: activeTab === tab.id ? '#667eea' : 'rgba(255,255,255,0.1)',
                background: activeTab === tab.id ? 'rgba(102,126,234,0.15)' : 'transparent',
                color: activeTab === tab.id ? '#667eea' : '#999',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Message Toast */}
      {message && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          padding: '10px 24px', borderRadius: 8, background: 'rgba(102,126,234,0.9)',
          color: '#fff', fontSize: 14, zIndex: 1000, boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>
          {message}
        </div>
      )}

      {/* Content */}
      <main style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
        {activeTab === 'articles' && (
          <ArticleList
            articles={state.articles}
            scanning={scanning}
            fetchingUrl={fetchingUrl}
            generatingIds={generatingIds}
            onScan={() => handleScan()}
            onFetchArticle={handleFetchArticle}
            onGenerateAudio={handleGenerateAudio}
            onDeleteArticle={handleDeleteArticle}
            onAddToQueue={handleAddToQueue}
            onArticleClick={handleArticleClick}
          />
        )}
        {activeTab === 'accounts' && (
          <AccountConfigPanel
            accounts={state.accounts}
            scanning={scanning}
            onSave={handleSaveAccount}
            onDelete={handleDeleteAccount}
            onScan={handleScan}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsPanel
            schedule={state.schedule}
            onSave={handleSaveSchedule}
          />
        )}
      </main>

      {/* Article Detail Modal */}
      {selectedArticle && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 900,
            background: 'rgba(0,0,0,0.7)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setSelectedArticle(null)}
        >
          <div
            style={{
              background: '#1a1a3e', borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.12)',
              maxWidth: 720, width: '100%', maxHeight: '85vh',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'flex-start', gap: 16,
            }}>
              <div style={{ flex: 1 }}>
                <h2 style={{
                  fontSize: 20, fontWeight: 700, lineHeight: 1.5,
                  margin: '0 0 12px 0', color: '#e8e8f0',
                }}>
                  {selectedArticle.title}
                </h2>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#888', flexWrap: 'wrap' }}>
                  <span>📢 {selectedArticle.accountName}</span>
                  <span>📅 {new Date(selectedArticle.publishDate).toLocaleDateString('zh-CN')}</span>
                  <span>{selectedArticle.content.length} 字</span>
                  {selectedArticle.audioGenerated && <span style={{ color: '#4caf50' }}>🎵 已生成音频</span>}
                </div>
              </div>
              <button
                onClick={() => setSelectedArticle(null)}
                style={{
                  background: 'rgba(255,255,255,0.08)', border: 'none',
                  color: '#999', fontSize: 18, cursor: 'pointer',
                  borderRadius: 8, width: 36, height: 36,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
                title="关闭"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div style={{
              padding: 24, overflowY: 'auto', flex: 1,
              fontSize: 15, lineHeight: 1.9, color: '#c8c8d4',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {selectedArticle.content || selectedArticle.summary ? (
                <p style={{ margin: 0 }}>
                  {selectedArticle.content || selectedArticle.summary}
                </p>
              ) : (
                <p style={{ color: '#666', fontStyle: 'italic', margin: 0 }}>
                  （文章内容暂未获取，请从存档站扫描或粘贴链接获取完整内容）
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', flexWrap: 'wrap', gap: 12,
            }}>
              <a
                href={selectedArticle.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 13, color: '#667eea', textDecoration: 'none',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                🔗 查看原文
              </a>
              <div style={{ display: 'flex', gap: 8 }}>
                {!selectedArticle.audioGenerated && selectedArticle.content && (
                  <button
                    onClick={() => {
                      handleGenerateAudio(selectedArticle)
                      setSelectedArticle(null)
                    }}
                    style={{
                      padding: '8px 18px', borderRadius: 8, border: 'none',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      color: '#fff', cursor: 'pointer', fontSize: 14,
                    }}
                  >
                    🎙 生成音频
                  </button>
                )}
                {selectedArticle.audioGenerated && (
                  <button
                    onClick={() => {
                      handleAddToQueue(selectedArticle)
                      setSelectedArticle(null)
                    }}
                    style={{
                      padding: '8px 18px', borderRadius: 8, border: 'none',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      color: '#fff', cursor: 'pointer', fontSize: 14,
                    }}
                  >
                    ➕ 加入播放
                  </button>
                )}
                <button
                  onClick={() => setSelectedArticle(null)}
                  style={{
                    padding: '8px 18px', borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.06)',
                    color: '#999', cursor: 'pointer', fontSize: 14,
                  }}
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audio Player */}
      <AudioPlayer
        queue={state.playerQueue}
        currentPlayingId={state.currentPlayingId}
        isPlaying={state.isPlaying}
        onQueueChange={handleQueueChange}
        onPlayingChange={handlePlayingChange}
        onRemoveFromQueue={handleRemoveFromQueue}
      />
    </div>
  )
}

export default App
