const crypto = require('crypto');

function generateHmacSignature(secretKey, message) {
  return crypto.createHmac('sha256', secretKey).update(message).digest('hex');
}

function buildCoupangHeaders(method, path, accessKey, secretKey) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dt =
    now.getUTCFullYear() +
    pad(now.getUTCMonth() + 1) +
    pad(now.getUTCDate()) +
    'T' +
    pad(now.getUTCHours()) +
    pad(now.getUTCMinutes()) +
    pad(now.getUTCSeconds()) +
    'Z';

  const message = `${dt}\n${method}\n${path}\n`;
  const signature = generateHmacSignature(secretKey, message);

  return {
    Authorization: `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${dt}, signature=${signature}`,
    'Content-Type': 'application/json;charset=UTF-8',
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let body = {};
  if (req.method === 'POST') {
    body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) { body = {}; }
    }
  }

  const { action, accessKey, secretKey, keyword, productUrl, limit } = body;

  if (!accessKey || !secretKey) {
    return res.status(400).json({ error: 'API 키가 없습니다.' });
  }

  try {
    if (action === 'search') {
      const path = `/v2/providers/affiliate_open_api/apis/openapi/products/search?keyword=${encodeURIComponent(keyword)}&limit=${limit || 5}`;
      const headers = buildCoupangHeaders('GET', path, accessKey, secretKey);
      const response = await fetch(`https://api-gateway.coupang.com${path}`, { method: 'GET', headers });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json({ error: data.message || '쿠팡 API 오류' });
      return res.status(200).json({ products: data.data?.productData || [] });
    }

    if (action === 'deeplink') {
      const path = `/v2/providers/affiliate_open_api/apis/openapi/deeplink`;
      const headers = buildCoupangHeaders('POST', path, accessKey, secretKey);
      const response = await fetch(`https://api-gateway.coupang.com${path}`, {
        method: 'POST', headers, body: JSON.stringify({ coupangUrls: [productUrl] }),
      });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json({ error: data.message || '딥링크 생성 오류' });
      return res.status(200).json({ url: data.data?.[0]?.shortenUrl || data.data?.[0]?.landingUrl || null });
    }

    return res.status(400).json({ error: '잘못된 action입니다.' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
