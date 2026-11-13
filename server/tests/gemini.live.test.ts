import fs from 'node:fs'
import path from 'node:path'
import { GoogleGenAI } from '@google/genai'
import dotenv from 'dotenv'
import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(__dirname, '../..')
const envPath = path.join(repoRoot, '.env')
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: false })
}

const apiKey = process.env.GEMINI_API_KEY
const model = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite'
const enabled = process.env.RUN_GEMINI_TESTS === '1' && Boolean(apiKey)

describe.skipIf(!enabled)('live Gemini connectivity', () => {
  it(`generates a short response with ${model}`, async () => {
    const client = new GoogleGenAI({ apiKey })
    const response = await client.models.generateContent({
      model,
      contents: 'Reply with the single word OK.',
      config: { maxOutputTokens: 8, temperature: 0 },
    })
    expect(response.text?.trim()).toContain('OK')
  })
})
