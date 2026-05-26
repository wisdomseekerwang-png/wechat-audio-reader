import type { VercelRequest, VercelResponse } from '@vercel/node'

const TTS_MAX_CHUNK = 200

async function generateTTSChunk(text: string, lang: string): Promise<Buffer> {
  const encoded = encodeURIComponent(text)
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${lang}&client=tw-ob&total=1&idx=0`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`TTS request failed: ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } finally {
    clearTimeout(timeout)
  }
}

async function generateFullAudio(text: string, lang: string): Promise<Buffer> {
  // Clean the text
  const cleanText = text
    .replace(/<[^>]+>/g, '')
    .replace(/&[^;]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleanText) {
    throw new Error('No text content')
  }

  // Limit total length to prevent timeout
  const limitedText = cleanText.substring(0, 5000)

  // Split into sentences for better TTS
  const sentences = limitedText.split(/(?<=[。！？.!?])/g).filter(s => s.trim().length > 0)

  const chunks: string[] = []
  let currentChunk = ''

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > TTS_MAX_CHUNK && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      currentChunk = sentence
    } else {
      currentChunk += sentence
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  // Limit to 10 chunks to prevent timeout
  const maxChunks = Math.min(chunks.length, 10)

  const buffers: Buffer[] = []
  for (let i = 0; i < maxChunks; i++) {
    try {
      const buf = await generateTTSChunk(chunks[i], lang)
      if (buf.length > 0) {
        buffers.push(buf)
      }
    } catch (e) {
      console.error(`Chunk ${i} failed:`, e)
    }
  }

  if (buffers.length === 0) {
    throw new Error('Failed to generate any audio chunks')
  }

  return Buffer.concat(buffers as readonly Uint8Array[])
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { articleId, text } = req.body

    if (!articleId || !text) {
      return res.status(400).json({ error: 'articleId and text are required' })
    }

    const audioBuffer = await generateFullAudio(text, 'zh-CN')

    // Return the audio as base64 data URL
    const base64 = audioBuffer.toString('base64')
    const dataUrl = `data:audio/mpeg;base64,${base64}`

    return res.json({ audioUrl: dataUrl })
  } catch (error: any) {
    console.error('TTS generation error:', error)
    return res.status(500).json({ error: error.message || 'TTS generation failed' })
  }
}
