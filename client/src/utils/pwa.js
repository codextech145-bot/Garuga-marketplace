import { registerSW } from 'virtual:pwa-register'

const UPDATE_CHECK_INTERVAL = 30 * 1000
const APP_VERSION = __APP_VERSION__

function reloadForUpdate() {
  if (window.__garugaReloadingForUpdate) {
    return
  }

  window.__garugaReloadingForUpdate = true
  window.location.reload()
}

async function checkBuildVersion() {
  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache'
      }
    })

    if (!response.ok) {
      return
    }

    const data = await response.json()
    if (data.version && data.version !== APP_VERSION) {
      reloadForUpdate()
    }
  } catch {
    // Version checks should never interrupt the app.
  }
}

// PWA Support - generated service worker registration and install prompt
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return
  }

  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister())
    })

    if ('caches' in window) {
      caches.keys().then((cacheNames) => {
        cacheNames.forEach((cacheName) => caches.delete(cacheName))
      })
    }

    return
  }

  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateServiceWorker(true)
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) {
        return
      }

      registration.update()
      window.setInterval(() => {
        registration.update()
        checkBuildVersion()
      }, UPDATE_CHECK_INTERVAL)
    },
    onRegisterError(error) {
      console.log('Service Worker registration failed:', error)
    }
  })

  checkBuildVersion()
}

export function setupPWAInstallPrompt(onInstallPromptReady) {
  let deferredPrompt;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (onInstallPromptReady) {
      onInstallPromptReady(deferredPrompt);
    }
  });

  return {
    async install() {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        return outcome;
      }
      return null;
    }
  };
}

export function getNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }

  return Notification.permission;
}

export async function requestProductNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  return Notification.requestPermission();
}

export const requestNotificationPermission = requestProductNotificationPermission

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

export async function subscribeToPushNotifications(saveSubscription) {
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY

  if (!vapidPublicKey) {
    console.warn('Missing VITE_VAPID_PUBLIC_KEY. Push subscriptions cannot be created.')
    return 'missing-key'
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported'
  }

  const permission = await requestProductNotificationPermission()
  if (permission !== 'granted') {
    return permission
  }

  const registration = await navigator.serviceWorker.ready
  const existingSubscription = await registration.pushManager.getSubscription()
  const subscription =
    existingSubscription ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }))

  await saveSubscription(subscription.toJSON())
  return 'granted'
}

export async function showProductNotification(item) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const title = item?.productName ? `New product: ${item.productName}` : 'New product on Garuga';
  const price = Number(item?.price || 0);
  const bodyParts = [];

  if (price > 0) {
    bodyParts.push(`UGX ${price.toLocaleString()}`);
  }

  if (item?.location) {
    bodyParts.push(item.location);
  }

  const options = {
    body: bodyParts.length ? bodyParts.join(' - ') : 'A new item was just listed.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: item?.id ? `garuga-item-${item.id}` : 'garuga-new-item',
    data: {
      url: item?.id ? `/product/${item.id}` : '/'
    }
  };

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, options);
    return;
  }

  const notification = new Notification(title, options);
  notification.onclick = () => {
    window.focus();
    if (options.data.url) {
      window.location.assign(options.data.url);
    }
  };
}

export async function showOrderNotification({ title = 'Garuga order update', body = 'You have an order update.', url = '/dashboard', tag = 'garuga-order' }) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const options = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag,
    data: { url }
  };

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, options);
    return;
  }

  const notification = new Notification(title, options);
  notification.onclick = () => {
    window.focus();
    if (options.data.url) {
      window.location.assign(options.data.url);
    }
  };
}
