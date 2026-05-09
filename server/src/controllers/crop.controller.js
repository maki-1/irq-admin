const axios = require('axios');
const Jimp  = require('jimp');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL   = process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

// POST /api/crop-id/detect-id
// Body: { imageUrl }
// Returns: { croppedImage: "data:image/jpeg;base64,..." }
exports.detectId = async (req, res) => {
  try {
    if (!GROQ_API_KEY) {
      return res.status(503).json({ message: 'GROQ_API_KEY not configured' });
    }

    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ message: 'imageUrl is required' });

    // Fetch original image buffer
    const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000 });
    const buffer = Buffer.from(imgRes.data);
    const mime   = imgRes.headers['content-type'] || 'image/jpeg';
    const base64 = buffer.toString('base64');

    // Send to Groq vision — ask for tight bounding box around the ID card only
    const groqRes = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: GROQ_MODEL,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mime};base64,${base64}` },
            },
            {
              type: 'text',
              text:
                'Find the government ID card or physical card in this image. ' +
                'Return the tightest possible bounding box that contains ONLY the card — ' +
                'no background, no hands, no table, nothing outside the card edges. ' +
                'Return ONLY this JSON (values are 0.0–1.0 fractions of full image size): ' +
                '{"x":<left edge>,"y":<top edge>,"width":<card width>,"height":<card height>}. ' +
                'No explanation, no markdown.',
            },
          ],
        }],
        max_tokens: 150,
        temperature: 0,
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const text  = groqRes.data.choices?.[0]?.message?.content || '';
    const match = text.match(/\{[^}]+\}/);
    if (!match) return res.status(422).json({ message: 'Model could not detect ID boundaries' });

    const raw   = JSON.parse(match[0]);
    const clamp = (v) => Math.min(1, Math.max(0, Number(v) || 0));
    const coords = {
      x:      clamp(raw.x),
      y:      clamp(raw.y),
      width:  clamp(raw.width),
      height: clamp(raw.height),
    };

    // Crop with jimp — server-side, no CORS issues
    const image = await Jimp.read(buffer);
    const iw    = image.bitmap.width;
    const ih    = image.bitmap.height;

    const cropX = Math.round(coords.x * iw);
    const cropY = Math.round(coords.y * ih);
    const cropW = Math.max(1, Math.round(coords.width  * iw));
    const cropH = Math.max(1, Math.round(coords.height * ih));

    image.crop(cropX, cropY, cropW, cropH);

    const croppedBase64 = await image.getBase64Async(Jimp.MIME_JPEG);
    res.json({ croppedImage: croppedBase64 });
  } catch (err) {
    console.error('[crop] detectId error:', err.response?.data || err.message);
    res.status(500).json({ message: err.response?.data?.error?.message || err.message });
  }
};
