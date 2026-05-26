import React, { useState } from 'react'
import type { AccountConfig } from '../types'

interface Props {
  accounts: AccountConfig[]
  scanning: boolean
  onSave: (account: AccountConfig) => void
  onDelete: (id: string) => void
  onScan: (account: AccountConfig) => void
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.08)',
  padding: 24,
  marginBottom: 16,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)',
  color: '#e0e0e0',
  fontSize: 14,
  outline: 'none',
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

const btnDanger: React.CSSProperties = {
  padding: '8px 20px',
  borderRadius: 8,
  border: '1px solid rgba(255,80,80,0.3)',
  background: 'transparent',
  color: '#ff6b6b',
  cursor: 'pointer',
  fontSize: 14,
}

const AccountConfigPanel: React.FC<Props> = ({ accounts, scanning, onSave, onDelete, onScan }) => {
  const [newAccount, setNewAccount] = useState({ name: '', url: '' })
  const [editing, setEditing] = useState<string | null>(null)

  const handleAdd = () => {
    if (!newAccount.name.trim()) return
    const id = `acc_${Date.now()}`
    onSave({
      id,
      name: newAccount.name.trim(),
      url: newAccount.url.trim() || `https://rsshub.app/wechat/mp/profile/${encodeURIComponent(newAccount.name.trim())}`,
      enabled: true,
    })
    setNewAccount({ name: '', url: '' })
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>公众号管理</h2>

      {/* Add new account */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>添加公众号</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <input
              placeholder="公众号名称"
              value={newAccount.name}
              onChange={e => setNewAccount(prev => ({ ...prev, name: e.target.value }))}
              style={inputStyle}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div style={{ flex: 2, minWidth: 300 }}>
            <input
              placeholder="RSSHub链接 (留空自动生成)"
              value={newAccount.url}
              onChange={e => setNewAccount(prev => ({ ...prev, url: e.target.value }))}
              style={inputStyle}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <button onClick={handleAdd} style={btnPrimary}>添加</button>
        </div>
      </div>

      {/* Account list */}
      {accounts.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 40, color: '#666' }}>
          还没有添加公众号，请先添加
        </div>
      ) : (
        accounts.map(acc => (
          <div key={acc.id} style={cardStyle}>
            {editing === acc.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  value={acc.name}
                  onChange={e => onSave({ ...acc, name: e.target.value })}
                  style={inputStyle}
                  placeholder="公众号名称"
                />
                <input
                  value={acc.url}
                  onChange={e => onSave({ ...acc, url: e.target.value })}
                  style={inputStyle}
                  placeholder="RSSHub URL"
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setEditing(null)} style={btnPrimary}>完成</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                      {acc.name}
                      <span style={{
                        marginLeft: 10, fontSize: 12, padding: '2px 8px', borderRadius: 4,
                        background: acc.enabled ? 'rgba(80,200,120,0.15)' : 'rgba(255,255,255,0.06)',
                        color: acc.enabled ? '#4caf50' : '#888',
                      }}>
                        {acc.enabled ? '已启用' : '已禁用'}
                      </span>
                    </h3>
                    <p style={{ fontSize: 13, color: '#888', marginBottom: 4, wordBreak: 'break-all' }}>
                      {acc.url}
                    </p>
                    {acc.lastScanAt && (
                      <p style={{ fontSize: 12, color: '#666' }}>
                        上次扫描: {new Date(acc.lastScanAt).toLocaleString('zh-CN')}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => onScan(acc)}
                      disabled={scanning}
                      style={{ ...btnPrimary, opacity: scanning ? 0.5 : 1 }}
                    >
                      {scanning ? '扫描中...' : '手动扫描'}
                    </button>
                    <button
                      onClick={() => onSave({ ...acc, enabled: !acc.enabled })}
                      style={{
                        padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
                        background: 'transparent', color: acc.enabled ? '#ff6b6b' : '#4caf50', cursor: 'pointer', fontSize: 14,
                      }}
                    >
                      {acc.enabled ? '禁用' : '启用'}
                    </button>
                    <button onClick={() => setEditing(acc.id)} style={{
                      padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
                      background: 'transparent', color: '#999', cursor: 'pointer', fontSize: 14,
                    }}>
                      编辑
                    </button>
                    <button onClick={() => onDelete(acc.id)} style={btnDanger}>删除</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

export default AccountConfigPanel
