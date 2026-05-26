import React, { useState, useEffect } from 'react'
import type { ScheduleConfig } from '../types'

interface Props {
  schedule: ScheduleConfig
  onSave: (config: ScheduleConfig) => void
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.08)',
  padding: 24,
  marginBottom: 16,
}

const inputStyle: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)',
  color: '#e0e0e0',
  fontSize: 14,
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#999',
  marginBottom: 6,
}

const btnPrimary: React.CSSProperties = {
  padding: '10px 32px',
  borderRadius: 8,
  border: 'none',
  background: 'linear-gradient(135deg, #667eea, #764ba2)',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
}

const SettingsPanel: React.FC<Props> = ({ schedule, onSave }) => {
  const [local, setLocal] = useState<ScheduleConfig>(schedule)

  useEffect(() => {
    setLocal(schedule)
  }, [schedule])

  const handleSave = () => {
    onSave(local)
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>定时设置</h2>

      {/* Schedule time */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>每日扫描时间</h3>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
          设置每天自动扫描公众号更新的时间（部署到Vercel后通过Cron Job执行）
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={labelStyle}>小时 (0-23)</div>
            <input
              type="number"
              min={0}
              max={23}
              value={local.scanHour}
              onChange={e => setLocal(prev => ({ ...prev, scanHour: parseInt(e.target.value) || 0 }))}
              style={{ ...inputStyle, width: 80 }}
            />
          </div>
          <span style={{ fontSize: 18, color: '#666', marginTop: 20 }}>:</span>
          <div>
            <div style={labelStyle}>分钟 (0-59)</div>
            <input
              type="number"
              min={0}
              max={59}
              value={local.scanMinute}
              onChange={e => setLocal(prev => ({ ...prev, scanMinute: parseInt(e.target.value) || 0 }))}
              style={{ ...inputStyle, width: 80 }}
            />
          </div>
          <div style={{ marginTop: 20 }}>
            <span style={{ fontSize: 14, color: '#667eea' }}>
              北京时间
            </span>
          </div>
        </div>
        <p style={{ fontSize: 12, color: '#666', marginTop: 12 }}>
          当前设置: 每天 {String(local.scanHour).padStart(2, '0')}:{String(local.scanMinute).padStart(2, '0')} (北京时间)
        </p>
      </div>

      {/* Auto-generate toggle */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>自动生成音频</h3>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={local.autoGenerateAudio}
            onChange={e => setLocal(prev => ({ ...prev, autoGenerateAudio: e.target.checked }))}
            style={{ width: 18, height: 18, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 14 }}>扫描到新文章后自动生成音频</span>
        </label>
      </div>

      {/* TTS settings */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>朗读设置</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={labelStyle}>语速: {local.rate.toFixed(1)}x</div>
            <input
              type="range"
              min={0.5}
              max={2.0}
              step={0.1}
              value={local.rate}
              onChange={e => setLocal(prev => ({ ...prev, rate: parseFloat(e.target.value) }))}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <div style={labelStyle}>音量: {Math.round(local.volume * 100)}%</div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={local.volume}
              onChange={e => setLocal(prev => ({ ...prev, volume: parseFloat(e.target.value) }))}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* Save */}
      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button onClick={handleSave} style={btnPrimary}>保存设置</button>
      </div>

      {/* Vercel Cron Note */}
      <div style={{ ...cardStyle, marginTop: 16, background: 'rgba(102,126,234,0.08)', borderColor: 'rgba(102,126,234,0.2)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#667eea' }}>部署提示</h3>
        <p style={{ fontSize: 13, color: '#aaa', lineHeight: 1.6 }}>
          部署到 Vercel 后，需要修改 <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>vercel.json</code> 中的 cron schedule 来匹配你的扫描时间。
          当前前端展示的时间仅作为参考，实际执行由 Vercel Cron Job 控制。
        </p>
      </div>
    </div>
  )
}

export default SettingsPanel
