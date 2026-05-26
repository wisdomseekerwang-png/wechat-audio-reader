import React, { useState } from 'react'
import type { AccountConfig, AccountSourceType } from '../types'

interface Props {
  accounts: AccountConfig[]
  scanning: boolean
  onSave: (account: AccountConfig) => void
  onDelete: (id: string) => void
  onScan: (account: AccountConfig) => void
}

const S = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    padding: 24,
    marginBottom: 16,
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: '#e0e0e0',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  select: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: '#e0e0e0',
    fontSize: 14,
    outline: 'none',
    cursor: 'pointer',
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
  btnDanger: {
    padding: '8px 20px',
    borderRadius: 8,
    border: '1px solid rgba(255,80,80,0.3)',
    background: 'transparent',
    color: '#ff6b6b',
    cursor: 'pointer',
    fontSize: 14,
  } as React.CSSProperties,
  tag: (active: boolean) => ({
    display: 'inline-block',
    marginLeft: 10,
    fontSize: 12,
    padding: '2px 8px',
    borderRadius: 4,
    background: active ? 'rgba(80,200,120,0.15)' : 'rgba(255,255,255,0.06)',
    color: active ? '#4caf50' : '#888',
  }) as React.CSSProperties,
}

function genId() {
  return `acc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
}

const AccountConfigPanel: React.FC<Props> = ({ accounts, scanning, onSave, onDelete, onScan }) => {
  const [sourceType, setSourceType] = useState<AccountSourceType>('biz')
  const [acctName, setAcctName] = useState('')
  const [acctValue, setAcctValue] = useState('')
  const [editing, setEditing] = useState<string | null>(null)

  const handleAdd = () => {
    if (!acctName.trim() || !acctValue.trim()) return
    onSave({
      id: genId(),
      name: acctName.trim(),
      sourceType,
      value: acctValue.trim(),
      enabled: true,
    })
    setAcctName('')
    setAcctValue('')
  }

  const typeLabel = (t: AccountSourceType) => t === 'biz' ? '__biz 直连' : '搜狗搜索'

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>公众号管理</h2>

      {/* Add account */}
      <div style={S.card}>
        <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>添加公众号</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 2fr 80px', gap: 12, alignItems: 'end' }}>
          <select value={sourceType} onChange={e => setSourceType(e.target.value as AccountSourceType)} style={S.select}>
            <option value="biz">__biz 直连</option>
            <option value="sogou">搜狗搜索</option>
          </select>
          <input
            placeholder="公众号名称"
            value={acctName}
            onChange={e => setAcctName(e.target.value)}
            style={S.input}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <input
            placeholder={sourceType === 'biz' ? '粘贴 __biz 值 (从文章链接中提取)' : '输入公众号准确名称'}
            value={acctValue}
            onChange={e => setAcctValue(e.target.value)}
            style={S.input}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button onClick={handleAdd} style={S.btnPrimary}>添加</button>
        </div>
        <p style={{ fontSize:12, color:'#666', marginTop:8, marginBottom:0 }}>
          {sourceType === 'biz'
            ? '💡 __biz 获取方法: 打开任意一篇该公众号文章 → 点击右上角 ··· → 复制链接 → 链接中包含 __biz=xxx 参数'
            : '💡 搜狗搜索: 输入公众号的准确名称，系统将通过搜狗微信搜索查找最新文章'}
        </p>
      </div>

      {/* Account list */}
      {accounts.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: 40, color: '#666' }}>
          还没有添加公众号，请先添加
        </div>
      ) : (
        accounts.map(acc => (
          <div key={acc.id} style={S.card}>
            {editing === acc.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 2fr', gap: 12 }}>
                  <select
                    value={acc.sourceType}
                    onChange={e => onSave({ ...acc, sourceType: e.target.value as AccountSourceType })}
                    style={S.select}
                  >
                    <option value="biz">__biz 直连</option>
                    <option value="sogou">搜狗搜索</option>
                  </select>
                  <input
                    value={acc.name}
                    onChange={e => onSave({ ...acc, name: e.target.value })}
                    style={S.input}
                    placeholder="公众号名称"
                  />
                  <input
                    value={acc.value}
                    onChange={e => onSave({ ...acc, value: e.target.value })}
                    style={S.input}
                    placeholder={acc.sourceType === 'biz' ? '__biz 值' : '公众号名称'}
                  />
                </div>
                <button onClick={() => setEditing(null)} style={S.btnPrimary}>完成</button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                      {acc.name}
                      <span style={S.tag(acc.enabled)}>{acc.enabled ? '已启用' : '已禁用'}</span>
                      <span style={{ ...S.tag(true), background: acc.sourceType === 'biz' ? 'rgba(102,126,234,0.15)' : 'rgba(255,165,0,0.15)', color: acc.sourceType === 'biz' ? '#667eea' : '#ffa500' }}>
                        {typeLabel(acc.sourceType)}
                      </span>
                    </h3>
                    <p style={{ fontSize: 13, color: '#888', marginBottom: 4, wordBreak: 'break-all', fontFamily: 'monospace' }}>
                      {acc.value}
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
                      style={{ ...S.btnPrimary, opacity: scanning ? 0.5 : 1 }}
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
                    <button
                      onClick={() => setEditing(acc.id)}
                      style={{
                        padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
                        background: 'transparent', color: '#999', cursor: 'pointer', fontSize: 14,
                      }}
                    >
                      编辑
                    </button>
                    <button onClick={() => onDelete(acc.id)} style={S.btnDanger}>删除</button>
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
