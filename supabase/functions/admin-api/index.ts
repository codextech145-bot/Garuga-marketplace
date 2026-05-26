import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function isValidAdminKey(key: unknown) {
  const cleanKey = String(key || '').replace(/\D/g, '')
  const expectedHash = Deno.env.get('ADMIN_KEY_HASH') || ''
  return Boolean(expectedHash && cleanKey.length === 15 && (await sha256Hex(cleanKey)) === expectedHash)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    if (!(await isValidAdminKey(body.key))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '')

    if (body.action === 'listProfiles') {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return new Response(JSON.stringify({ profiles: data || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (body.action === 'listItems') {
      const { data, error } = await supabase.from('items').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return new Response(JSON.stringify({ items: data || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (body.action === 'updateItem') {
      const { data, error } = await supabase
        .from('items')
        .update(body.payload || {})
        .eq('id', body.itemId)
        .select('*')
        .single()
      if (error) throw error
      return new Response(JSON.stringify({ item: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (body.action === 'deleteItem') {
      const { error } = await supabase.from('items').delete().eq('id', body.itemId)
      if (error) throw error
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (body.action === 'getSiteContent') {
      const { data, error } = await supabase.from('site_content').select('*').eq('id', 'main').maybeSingle()
      if (error) throw error
      return new Response(JSON.stringify({ siteContent: data?.data || null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (body.action === 'saveSiteContent') {
      const { error } = await supabase.from('site_content').upsert({
        id: 'main',
        data: body.data || {},
        updated_by: body.updatedBy || null,
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Admin API failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
