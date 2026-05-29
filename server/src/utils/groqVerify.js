const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function verifyIdentity(facePhotoUrl, idFrontUrl) {
  const response = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
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
    max_tokens: 150,
  });

  const text = response.choices[0]?.message?.content || '';
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}

  return { faceMatch: 'UNCERTAIN', idValid: 'UNCERTAIN', confidence: 'LOW', notes: text.slice(0, 200) };
}

module.exports = { verifyIdentity };
