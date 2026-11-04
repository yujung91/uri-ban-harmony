export function createStorage({ url, secretKey, bucket = 'harmony-media', request = fetch }) {
  const root = `${url}/storage/v1/object`;
  const headers = { apikey: secretKey, Authorization: `Bearer ${secretKey}` };
  const objectPath = key => {
    if (!key || key.split('/').some(part => !part || part === '.' || part === '..')) throw Error('Invalid storage key');
    return `${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`;
  };
  return {
    async put(key, body, options = {}) {
      const response = await request(`${root}/${objectPath(key)}`, { method: 'POST', headers: { ...headers, 'Content-Type': options.httpMetadata?.contentType || 'application/octet-stream', 'x-upsert': 'false' }, body });
      if (!response.ok) throw Error('Storage upload failed');
    },
    async get(key) {
      const response = await request(`${root}/authenticated/${objectPath(key)}`, { headers, cache: 'no-store' });
      if (response.status === 404) return null;
      if (!response.ok) throw Error('Storage download failed');
      return { body: response.body };
    },
    async delete(keys) {
      const prefixes = Array.isArray(keys) ? keys : [keys];
      if (!prefixes.length) return;
      prefixes.forEach(objectPath);
      const response = await request(`${root}/${encodeURIComponent(bucket)}`, { method: 'DELETE', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes }) });
      if (!response.ok) throw Error('Storage delete failed');
    },
  };
}
