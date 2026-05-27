const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers || {}),
    },
  })
}

function extensionFor(type) {
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  if (type === 'image/gif') return 'gif'
  return 'jpg'
}

async function getSupabaseUser(request, env) {
  const authHeader = request.headers.get('authorization') || ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) return null

  const response = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.VITE_SUPABASE_ANON_KEY,
      authorization: authHeader,
    },
  })

  if (!response.ok) return null
  return response.json()
}

export async function onRequestPost({ request, env }) {
  if (!env.GARUGA_IMAGES) {
    return json({ error: 'Cloudflare image storage is not configured.' }, { status: 503 })
  }

  const user = await getSupabaseUser(request, env)
  if (!user?.id) {
    return json({ error: 'Please sign in before uploading product photos.' }, { status: 401 })
  }

  const formData = await request.formData()
  const image = formData.get('image')

  if (!(image instanceof File)) {
    return json({ error: 'No image file was uploaded.' }, { status: 400 })
  }

  if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
    return json({ error: 'Upload a JPG, PNG, WEBP, or GIF image.' }, { status: 400 })
  }

  if (image.size > MAX_IMAGE_BYTES) {
    return json({ error: 'Image is too large. Maximum size is 5MB.' }, { status: 400 })
  }

  const now = new Date()
  const key = [
    'products',
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    `${user.id}-${crypto.randomUUID()}.${extensionFor(image.type)}`,
  ].join('-')

  await env.GARUGA_IMAGES.put(key, image.stream(), {
    httpMetadata: {
      contentType: image.type,
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: {
      userId: user.id,
      originalName: image.name || 'product-image',
    },
  })

  return json({
    key,
    url: `/api/images/${encodeURIComponent(key)}`,
  })
}

export async function onRequest() {
  return json({ error: 'Method not allowed.' }, { status: 405 })
}
