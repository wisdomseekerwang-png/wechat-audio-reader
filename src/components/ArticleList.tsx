import React, { useState } from 'react'
import type { Article } from '../types'

interface Props {
  articles: Article[]
  scanning: boolean
  fetchingUrl: boolean
  generatingIds: Set<string>
  onScan: () => void
  onFetchArticle: (url: string) => void
  onGenerateAudio: (article: Article) => void
  onDeleteArticle: (id: string) => void
  onAddToQueue: (article: Article) => void
}

const S = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    padding: 20,
    marginBottom: 12,
  } as React.CSSProperties,
  input: {
    flex: 1,
    minWidth: 280,
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: '#e0e0e0',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  btnPrimary: {
    padding: '8px 20px',
    borderRadius: 8,
    border: 'none',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
  } as React.CSSProperties,
  btnSmall: {
    padding: '6px 14px',
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: '#999',
    cursor: 'pointer',
    fontSize: 13,
  } as React.CSSProperties,
  tag: (color: string) => ({
    display: 'inline-block',
    fontSize: 11,
    padding: '2px 6px',
    borderRadius: 4,
    background: `rgba(${color},0.12)`,
    color: `rgb(${color})`,
    marginLeft: 6,
    verticalAlign: 'middle',
  }),
}

const ArticleList: React.FC<Props> = ({
  articles, scanning, fetchingUrl, generatingIds,
  onScan, onFetchArticle, onGenerateAudio, onDeleteArticle, onAddToQueue,
}) => {
  const [pasteUrl, setPasteUrl] = useState('')
  const unreadCount = articles.filter(a => !a.isRead).length

  const handlePaste = () => {
    const url = pasteUrl.trim()
    if (!url) return
    if (!url.includes('mp.weixin.qq.com') && !url.includes('weixin.qq.com')) {
      return // silently ignore non-wechat URLs
    }
    onFetchArticle(url)
    setPasteUrl('')
  }

  const sourceLabel = (a: Article) => {
    if (a.sourceType === 'url') return { text: '链接', color: '0,200,200' }
    if (a.sourceType === 'biz') return { text: '直连', color: '102,126,234' }
    if (a.sourceType === 'sogou') return { text: '微信搜索', color: '255,165,0' }
    return null
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>文章列表</h2>
          <p style={{ fontSize: 14, color: '#888' }}>
            共 {articles.length} 篇 · {unreadCount} 篇未读
          </p>
        </div>
        <button onClick={onScan} disabled={scanning} style={{ ...S.btnPrimary, opacity: scanning ? 0.5 : 1 }}>
          {scanning ? '🔄 扫描中...' : '🔍 立即扫描'}
        </button>
      </div>

      {/* Paste URL quick-add */}
      <div style={{ ...S.card, marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>📎 粘贴文章链接 (快速添加)</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            placeholder="粘贴微信公众号文章链接..."
            value={pasteUrl}
            onChange={e => setPasteUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handlePaste()}
            style={S.input}
          />
          <button onClick={handlePaste} disabled={fetchingUrl || !pasteUrl.trim()} style={{
            ...S.btnPrimary,
            opacity: fetchingUrl || !pasteUrl.trim() ? 0.5 : 1,
            flexShrink: 0,
          }}>
            {fetchingUrl ? '获取中...' : '获取文章'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: '#666', marginTop: 8, marginBottom: 0 }}>
          复制公众号文章链接，粘贴到此处即可快速获取内容并生成音频
        </p>
      </div>

      {articles.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: 60, color: '#666' }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>📭</p>
          <p>还没有文章，请先粘贴链接或配置公众号扫描</p>
          <button onClick={onScan} disabled={scanning} style={{ ...S.btnPrimary, marginTop: 16 }}>
            开始扫描
          </button>
        </div>
      ) : (
        articles.map(article => (
          <div key={article.id} style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 250 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  {!article.isRead && (
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', background: '#667eea',
                      display: 'inline-block', flexShrink: 0,
                    }} />
                  )}
                  <h3 style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.4 }}>
                    {article.title}
                    {sourceLabel(article) && (
                      <span style={S.tag(sourceLabel(article)!.color)}>{sourceLabel(article)!.text}</span>
                    )}
                  </h3>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#888', flexWrap: 'wrap' }}>
                  <span>📢 {article.accountName}</span>
                  <span>📅 {new Date(article.publishDate).toLocaleDateString('zh-CN')}</span>
                  <span>{article.content.length} 字</span>
                  {article.audioGenerated && <span style={{ color: '#4caf50' }}>🎵 已生成音频</span>}
                  {article.audioGenerating && <span style={{ color: '#ffa726' }}>⏳ 生成中...</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
                {article.audioGenerated ? (
                  <button
                    onClick={() => onAddToQueue(article)}
                    style={{ ...S.btnSmall, color: '#667eea', borderColor: 'rgba(102,126,234,0.3)' }}
                  >
                    ➕ 加入播放
                  </button>
                ) : (
                  <button
                    onClick={() => onGenerateAudio(article)}
                    disabled={generatingIds.has(article.id)}
                    style={{ ...S.btnSmall, color: '#ffa726', borderColor: 'rgba(255,167,38,0.3)', opacity: generatingIds.has(article.id) ? 0.5 : 1 }}
                  >
                    {generatingIds.has(article.id) ? '生成中...' : '🎙 生成音频'}
                  </button>
                )}
                <button onClick={() => onDeleteArticle(article.id)} style={S.btnSmall}>
                  🗑
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

export default ArticleList
