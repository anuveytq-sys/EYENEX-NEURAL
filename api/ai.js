export default async function handler(req, res) {
  const allowedOrigin = process.env.EYENEX_ALLOWED_ORIGIN || 'https://anuveytq-sys.github.io';
  const origin = req.headers.origin || '';
  if (origin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (origin && origin !== allowedOrigin) return res.status(403).json({ error: 'Origin not allowed' });

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return res.status(503).json({ error: 'Server AI key is not configured.' });

  const body = req.body || {};
  const model = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : 'openrouter/auto';
  const messages = Array.isArray(body.messages) ? body.messages.slice(0, 40) : [];
  if (!messages.length) return res.status(400).json({ error: 'At least one message is required.' });

  try {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': allowedOrigin,
        'X-Title': 'EYENEX NEURAL'
      },
      body: JSON.stringify({ model, messages })
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    return res.send(text);
  } catch (error) {
    return res.status(502).json({ error: 'AI upstream request failed.' });
  }
}
