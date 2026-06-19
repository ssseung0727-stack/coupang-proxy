const crypto = require('crypto');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const body = req.body || {};
  const { action, accessKey, secretKey, keyword, productUrl, limit } = body;

  if (!accessKey || !secretKey) {
    return res.status(400).json({ error: 'API 키가 없습니다.' });
  }

  function getDatetime() {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const MM = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const HH = String(now.getUTCHours()).padStart(2, '0');
    const mm = String(now.getUTCMinutes()).padStart(2, '0');
    const ss = String(now.getUTCSeconds()).padStart(2, '0');
    return `${yyyy}${MM}${dd}T${HH}${mm}${ss}Z`;
  }

  function sign(secretKey, method, path, datetime) {
    const message = datetime + method + path + '';
    return crypto.createHmac('sha256', secretKey).update(message).digest('hex');
  }

  function makeHeaders(method, path) {
    const datetime = getDatetime();
    const signature = sign(secretKey, method, path, datetime);
    return {
      'Authorization': `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`,
      'Content-Type': 'application/json;charset=UTF-8',
    };
  }

  try {
    if (action === 'search') {
      const path = `/v2/providers/affiliate_open_api/apis/openapi/products/search?keyword=${encodeURIComponent(keyword)}&limit=${limit || 5}`;
      const headers = makeHeaders('GET', path);
      const response = await fetch(`https://api-gateway.coupang.com${path}`, { method: 'GET', headers });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json({ error: data.message || '쿠팡 API 오류' });
      return res.status(200).json({ products: data.data?.productData || [] });
    }

    if (action === 'deeplink') {
      const path = `/v2/providers/affiliate_open_api/apis/openapi/deeplink`;
      const headers = makeHeaders('POST', path);
      const response = await fetch(`https://api-gateway.coupang.com${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ coupangUrls: [productUrl] }),
      });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json({ error: data.message || '딥링크 오류' });
      return res.status(200).json({ url: data.data?.[0]?.shortenUrl || data.data?.[0]?.landingUrl || null });
    }

    return res.status(400).json({ error: '잘못된 action' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
