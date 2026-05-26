import React from 'react'
import type { Article } from '../types'

interface Props {
  articles: Article[]
  scanning: boolean
  generatingIds: Set<string>
  onScan: () => void
  onGenerateAudio: (article: Article) => void
  onDeleteArticle: (id: string) => void
  onAddToQueue: (article: Article) => void
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.08)',
  padding: 20,
  marginBottom: 12,
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 20px',
  borderRadius: 8,
  border: 'none',
  background: 'linear-gradient(135deg, #667eea, #764ba2)',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
}

const btnSmall: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)',
  color: '#999',
  cursor: 'pointer',
  fontSize: 13,
}

const ArticleList: React.FC<Props> = ({ articles, scanning, generatingIds, onScan, onGenerateAudio, onDeleteArticle, onAddToQueue }) => {
  const unreadCount = articles.filter(a => !a.isRead).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>文章列表</h2>
          <p style={{ fontSize: 14, color: '#888' }}>
            共 {articles.length} 篇 · {unreadCount} 篇未读
          </p>
        </div>
        <button onClick={onScan} disabled={scanning} style={{ ...btnPrimary, opacity: scanning ? 0.5 : 1 }}>
          {scanning ? '🔄 扫描中...' : '🔍 立即扫描'}
        </button>
      </div>

      {articles.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 60, color: '#666' }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>📭</p>
          <p>还没有文章，请先配置公众号并扫描</p>
          <button onClick={onScan} disabled={scanning} style={{ ...btnPrimary, marginTop: 16 }}>
            开始扫描
          </button>
        </div>
      ) : (
        articles.map(article => (
          <div key={article.id} style={cardStyle}>
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
                  <>
                    <button
                      onClick={() => onAddToQueue(article)}
                      style={{ ...btnSmall, color: '#667eea', borderColor: 'rgba(102,126,234,0.3)' }}
                    >
                      ➕ 加入播放
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onGenerateAudio(article)}
                    disabled={generatingIds.has(article.id)}
                    style={{ ...btnSmall, color: '#ffa726', borderColor: 'rgba(255,167,38,0.3)', opacity: generatingIds.has(article.id) ? 0.5 : 1 }}
                  >
                    {generatingIds.has(article.id) ? '生成中...' : '🎙 生成音频'}
                  </button>
                )}
                <button onClick={() => onDeleteArticle(article.id)} style={btnSmall}>
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
