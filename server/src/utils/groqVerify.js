const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// meta-llama/llama-4-scout-17b-16e-instruct is no longer available on this Groq
// account and returns 404 model_not_found. Qwen3.8-27B is the vision model the
// account does expose. It reasons before answering, so the token budget is
// larger and reasoning_format keeps message.content as plain JSON.
const GROQ_MODEL = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';

async function verifyIdentity(facePhotoUrl, idFrontUrl) {
  const response = await groq.chat.completions.create({
    model: GROQ_MODEL,
    reasoning_format: 'hidden',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `You are an identity verification assistant. You are given two images:
Image 1: A selfie / face photo of a person
Image 2: A government-issued ID card

Evaluate the following and respond ONLY with valid JSON, no extra text:
1. faceMatch — does the face in Image 1 match the face on the ID in Image 2? ("YES", "NO", or "UNCERTAIN")
2. idValid — does Image 2 appear to be a legitimate, unedited, readable government ID? ("YES", "NO", or "UNCERTAIN")
3. confidence — your overall confidence ("HIGH", "MEDIUM", or "LOW")
4. notes — one short sentence noting any issues, or "None" if all looks good

Respond in this exact format:
{"faceMatch":"YES","idValid":"YES","confidence":"HIGH","notes":"None"}`,
          },
          { type: 'image_url', image_url: { url: facePhotoUrl } },
          { type: 'image_url', image_url: { url: idFrontUrl } },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 1024,
  });

  const text = response.choices[0]?.message?.content || '';
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}

  return { faceMatch: 'UNCERTAIN', idValid: 'UNCERTAIN', confidence: 'LOW', notes: text.slice(0, 200) };
}

module.exports = { verifyIdentity };
