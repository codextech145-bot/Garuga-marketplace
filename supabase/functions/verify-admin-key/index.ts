const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { key } = await req.json()
    const cleanKey = String(key || '').replace(/\D/g, '')
    const expectedHash = Deno.env.get('ADMIN_KEY_HASH') || ''

    if (!expectedHash || cleanKey.length !== 15) {
      return new Response(JSON.stringify({ ok: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const keyHash = await sha256Hex(cleanKey)

    return new Response(JSON.stringify({ ok: keyHash === expectedHash }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ ok: false }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
