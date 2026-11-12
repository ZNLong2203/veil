/**
 * Split text into chunks that fit the on-device context window (Gemini Nano on the web: about
 * 9,216 tokens in total, input plus output). Prefers paragraph, then sentence, then hard breaks.
 */
export function chunkText(text: string, maxChars = 2400): string[] {
  const clean = text.replace(/\r\n?/g, '\n').trim()
  if (!clean) return []
  if (clean.length <= maxChars) return [clean]

  const pieces: string[] = []
  for (const para of clean.split(/\n{2,}/)) {
    if (para.length <= maxChars) {
      pieces.push(para)
      continue
    }
    // Paragraph too long: split on sentence ends, then hard-split whatever is still too long.
    let buf = ''
    for (const sentence of para.split(/(?<=[.!?])\s+/)) {
      if (buf && buf.length + sentence.length + 1 > maxChars) {
        pieces.push(buf)
        buf = ''
      }
      if (sentence.length > maxChars) {
        for (let i = 0; i < sentence.length; i += maxChars) pieces.push(sentence.slice(i, i + maxChars))
      } else {
        buf = buf ? `${buf} ${sentence}` : sentence
      }
    }
    if (buf) pieces.push(buf)
  }

  const chunks: string[] = []
  let cur = ''
  for (const p of pieces) {
    if (cur && cur.length + p.length + 2 > maxChars) {
      chunks.push(cur)
      cur = p
    } else {
      cur = cur ? `${cur}\n\n${p}` : p
    }
  }
  if (cur) chunks.push(cur)
  return chunks
}
