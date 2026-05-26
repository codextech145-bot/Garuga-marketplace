import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type PushPayload = {
  recipientUserIds?: string[]
  recipientRole?: 'buyer' | 'seller' | 'delivery'
  title?: string
  body?: string
  url?: string
  tag?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:support@garuga.local'
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || ''
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || ''

    if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
      throw new Error('Missing Supabase or VAPID environment variables.')
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    const payload = (await req.json()) as PushPayload
    const recipientUserIds = [...new Set(payload.recipientUserIds || [])].filter(Boolean)

    if (!recipientUserIds.length && !payload.recipientRole) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const subscriptionsByEndpoint = new Map<string, { id: string; endpoint: string; subscription: unknown }>()

    if (recipientUserIds.length) {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, subscription')
        .in('user_id', recipientUserIds)
      if (error) throw error
      ;(data || []).forEach((row) => subscriptionsByEndpoint.set(row.endpoint, row))
    }

    if (payload.recipientRole) {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, subscription')
        .eq('role', payload.recipientRole)
      if (error) throw error
      ;(data || []).forEach((row) => subscriptionsByEndpoint.set(row.endpoint, row))
    }

    const subscriptions = [...subscriptionsByEndpoint.values()]

    const message = JSON.stringify({
      title: payload.title || 'Garuga Marketplace',
      body: payload.body || 'You have a new update.',
      url: payload.url || '/',
      tag: payload.tag || 'garuga-update',
    })

    const results = await Promise.allSettled(
      subscriptions.map(async (row) => {
        try {
          await webpush.sendNotification(row.subscription as webpush.PushSubscription, message)
          return true
        } catch (error) {
          const statusCode = typeof error === 'object' && error && 'statusCode' in error ? error.statusCode : null
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', row.id)
          }
          throw error
        }
      })
    )

    const sent = results.filter((result) => result.status === 'fulfilled').length

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Push failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
