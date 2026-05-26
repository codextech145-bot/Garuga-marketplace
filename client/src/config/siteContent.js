export const defaultSiteContent = {
  supportPhone: '+256743505861',
  supportLabel: 'Need help with Garuga Marketplace?',
  supportWhatsappMessage: 'Hi Garuga Marketplace, I need help.',
  announcementEnabled: true,
  announcementBadge: 'Community Update',
  announcementTitle: 'Garuga Marketplace is open for trusted local buying and selling.',
  announcementMessage:
    'Post clear photos, honest prices, and real contact details so buyers can reach you faster.',
  announcementCtaLabel: 'Sell an item',
  announcementCtaUrl: '/add',
  promoEnabled: true,
  promoEyebrow: 'Advert Space',
  promoTitle: 'Promote your business with a homepage spotlight.',
  promoMessage:
    'Use the admin dashboard to place campaign text, event updates, school notices, or shop adverts on the front page.',
  promoCtaLabel: 'Contact admin',
  promoCtaUrl: 'https://wa.me/256743505861',
  promoDurationHours: 24,
  promoCloseDelaySeconds: 3,
  promoPublishedAt: null,
  promoExpiresAt: null,
  promoVersion: 'default',
  infoBarEnabled: true,
  infoBarText: 'Meet in safe public places and inspect items before paying.',
}

export function mergeSiteContent(data) {
  return {
    ...defaultSiteContent,
    ...(data || {}),
  }
}

export function normalizePhoneLink(phone) {
  const raw = String(phone || '').trim()
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return digits.startsWith('0') ? `+256${digits.slice(1)}` : raw.startsWith('+') ? raw : `+${digits}`
}
