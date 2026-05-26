self.addEventListener('push', (event) => {
  let payload = {}

  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data?.text() || '' }
  }

  const title = payload.title || 'Garuga Marketplace'
  const options = {
    body: payload.body || 'You have a new update.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: payload.tag || 'garuga-update',
    data: {
      url: payload.url || '/',
    },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => client.url.includes(self.location.origin))
      if (existingClient) {
        existingClient.focus()
        existingClient.navigate(url)
        return
      }

      return self.clients.openWindow(url)
    })
  )
})
