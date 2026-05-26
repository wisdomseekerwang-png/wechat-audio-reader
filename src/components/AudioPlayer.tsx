import React, { useCallback, useRef, useEffect, useState } from 'react'
import type { Article } from '../types'

interface Props {
  queue: Article[]
  currentPlayingId: string | null
  isPlaying: boolean
  onQueueChange: (queue: Article[]) => void
  onPlayingChange: (id: string | null, playing: boolean) => void
  onRemoveFromQueue: (id: string) => void
}

const AudioPlayer: React.FC<Props> = ({
  queue,
  currentPlayingId,
  isPlaying,
  onQueueChange,
  onPlayingChange,
  onRemoveFromQueue,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const synthRef = useRef(window.speechSynthesis)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const speakArticle = useCallback((article: Article) => {
    const synth = synthRef.current
    synth.cancel()

    const text = article.content.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').substring(0, 5000)
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = 1.0
    utterance.volume = 1.0
    utterance.pitch = 1.0

    // Try to use Chinese voice
    const voices = synth.getVoices()
    const chineseVoice = voices.find(v => v.lang.startsWith('zh-'))
    if (chineseVoice) utterance.voice = chineseVoice

    utterance.onend = () => {
      onPlayingChange(article.id, false)
      // Play next
      const idx = queue.findIndex(a => a.id === article.id)
      if (idx >= 0 && idx < queue.length - 1) {
        setCurrentIndex(idx + 1)
        onPlayingChange(queue[idx + 1].id, true)
        speakArticle(queue[idx + 1])
      } else {
        onPlayingChange(null, false)
      }
    }

    utterance.onerror = (e) => {
      console.error('TTS error:', e)
      onPlayingChange(article.id, false)
    }

    utteranceRef.current = utterance
    synth.speak(utterance)
  }, [queue, onPlayingChange])

  const handlePlay = useCallback(() => {
    if (queue.length === 0) return
    if (isPlaying) {
      synthRef.current.pause()
      onPlayingChange(currentPlayingId, false)
    } else if (currentPlayingId) {
      synthRef.current.resume()
      onPlayingChange(currentPlayingId, true)
    } else {
      const article = queue[currentIndex]
      if (article) {
        onPlayingChange(article.id, true)
        speakArticle(article)
      }
    }
  }, [queue, currentIndex, currentPlayingId, isPlaying, onPlayingChange, speakArticle])

  const handleStop = useCallback(() => {
    synthRef.current.cancel()
    utteranceRef.current = null
    onPlayingChange(null, false)
    setCurrentIndex(0)
  }, [onPlayingChange])

  const handlePrev = useCallback(() => {
    if (queue.length === 0) return
    const newIndex = Math.max(0, currentIndex - 1)
    setCurrentIndex(newIndex)
    synthRef.current.cancel()
    onPlayingChange(queue[newIndex].id, true)
    speakArticle(queue[newIndex])
  }, [queue, currentIndex, onPlayingChange, speakArticle])

  const handleNext = useCallback(() => {
    if (queue.length === 0) return
    const newIndex = currentIndex + 1
    if (newIndex >= queue.length) {
      handleStop()
      return
    }
    setCurrentIndex(newIndex)
    synthRef.current.cancel()
    onPlayingChange(queue[newIndex].id, true)
    speakArticle(queue[newIndex])
  }, [queue, currentIndex, onPlayingChange, speakArticle, handleStop])

  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    const newQueue = [...queue]
    const [moved] = newQueue.splice(fromIndex, 1)
    newQueue.splice(toIndex, 0, moved)
    onQueueChange(newQueue)
    // Adjust currentIndex
    if (fromIndex === currentIndex) {
      setCurrentIndex(toIndex)
    } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
      setCurrentIndex(currentIndex - 1)
    } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
      setCurrentIndex(currentIndex + 1)
    }
  }, [queue, currentIndex, onQueueChange])

  // Ensure voices are loaded
  useEffect(() => {
    const voices = synthRef.current.getVoices()
    if (voices.length === 0) {
      synthRef.current.onvoiceschanged = () => {}
    }
  }, [])

  const currentArticle = queue.find(a => a.id === currentPlayingId) || queue[currentIndex]

  return (
    <>
      {queue.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(15,15,35,0.97)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          padding: '16px 24px',
          zIndex: 100,
        }}>
          {/* Now playing indicator */}
          {currentArticle && isPlaying && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
              padding: '8px 16px', background: 'rgba(102,126,234,0.1)', borderRadius: 8,
            }}>
              <span style={{
                display: 'flex', gap: 2, alignItems: 'flex-end', height: 16,
              }}>
                <span style={{ width: 3, height: 12, background: '#667eea', borderRadius: 2, animation: 'bar 0.8s ease-in-out infinite alternate' }} />
                <span style={{ width: 3, height: 16, background: '#667eea', borderRadius: 2, animation: 'bar 0.6s ease-in-out infinite alternate', animationDelay: '0.2s' }} />
                <span style={{ width: 3, height: 8, background: '#667eea', borderRadius: 2, animation: 'bar 0.7s ease-in-out infinite alternate', animationDelay: '0.4s' }} />
                <span style={{ width: 3, height: 14, background: '#667eea', borderRadius: 2, animation: 'bar 0.5s ease-in-out infinite alternate', animationDelay: '0.1s' }} />
              </span>
              <span style={{ fontSize: 14, color: '#ccc' }}>
                正在播放: {currentArticle.title}
              </span>
            </div>
          )}

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={handlePrev} disabled={currentIndex <= 0} style={ctrlBtn}>
                ⏮
              </button>
              <button onClick={handlePlay} style={{ ...ctrlBtn, width: 44, height: 44, fontSize: 18 }}>
                {isPlaying ? '⏸' : '▶️'}
              </button>
              <button onClick={handleNext} disabled={currentIndex >= queue.length - 1} style={ctrlBtn}>
                ⏭
              </button>
              <button onClick={handleStop} style={ctrlBtn}>
                ⏹
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#999' }}>
              <span>
                {currentIndex + 1}/{queue.length}
              </span>
            </div>

            {/* Queue list */}
            <div style={{
              display: 'flex', gap: 8, overflowX: 'auto', maxWidth: 500, padding: '4px 0',
            }}>
              {queue.map((article, idx) => (
                <div
                  key={article.id}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    background: idx === currentIndex && isPlaying ? 'rgba(102,126,234,0.2)' : 'rgba(255,255,255,0.04)',
                    border: '1px solid',
                    borderColor: idx === currentIndex && isPlaying ? 'rgba(102,126,234,0.4)' : 'rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontSize: 13,
                    color: idx === currentIndex ? '#667eea' : '#999',
                  }}
                  onClick={() => {
                    synthRef.current.cancel()
                    setCurrentIndex(idx)
                    onPlayingChange(article.id, true)
                    speakArticle(article)
                  }}
                >
                  <span>{idx + 1}</span>
                  <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {article.title}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveFromQueue(article.id) }}
                    style={{
                      background: 'none', border: 'none', color: '#666', cursor: 'pointer',
                      fontSize: 14, padding: 0, lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bar {
          0% { height: 4px; }
          100% { height: 16px; }
        }
      `}</style>
    </>
  )
}

const ctrlBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: '50%',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.06)',
  color: '#e0e0e0',
  cursor: 'pointer',
  fontSize: 16,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

export default AudioPlayer
