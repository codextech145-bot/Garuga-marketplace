export async function onRequestGet({ params, env }) {
  if (!env.GARUGA_IMAGES) {
    return new Response('Cloudflare image storage is not configured.', { status: 503 })
  }

  const key = decodeURIComponent(params.key || '')
  if (!key || !key.startsWith('products-')) {
    return new Response('Not found', { status: 404 })
  }

  const object = await env.GARUGA_IMAGES.get(key)
  if (!object) {
    return new Response('Not found', { status: 404 })
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('cache-control', headers.get('cache-control') || 'public, max-age=31536000, immutable')

  return new Response(object.body, { headers })
}

export async function onRequest() {
  return new Response('Method not allowed.', { status: 405 })
}
