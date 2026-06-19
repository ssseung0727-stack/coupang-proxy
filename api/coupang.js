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

  function makeAuth(method, path, query) {
    const datetime = new Date().toISOString().substr(2, 17).replace(/:/gi, '').replace(/-/gi, '') + 'Z';
    const message = datetime + method + path + (query || '');
    const signature = crypto.createHmac('sha256', secretKey).update(message).digest('hex');
    const auth = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
    return { datetime, auth };
  }

  try {
    if (action === 'search') {
      const path = '/v2/providers/affiliate_open_api/apis/openapi/products/search';
      const query = `keyword=${encodeURIComponent(keyword)}&limit=${limit || 5}`;
      const { auth } = makeAuth('GET', path, query);
      const response = await fetch(`https://api-gateway.coupang.com${path}?${query}`, {
        method: 'GET',
        headers: { 'Authorization': auth, 'Content-Type': 'application/json;charset=UTF-8' }
      });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json({ error: data.message || '쿠팡 API 오류' });
      return res.status(200).json({ products: data.data?.productData || [] });
    }

    if (action === 'deeplink') {
      const path = '/v2/providers/affiliate_open_api/apis/openapi/deeplink';
      const query = '';
      const { auth } = makeAuth('POST', path, query);
      const response = await fetch(`https://api-gateway.coupang.com${path}`, {
        method: 'POST',
        headers: { 'Authorization': auth, 'Content-Type': 'application/json;charset=UTF-8' },
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
