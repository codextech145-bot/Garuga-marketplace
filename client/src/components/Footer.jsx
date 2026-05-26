import { defaultSiteContent, normalizePhoneLink } from '../config/siteContent'

function Footer() {
  const siteContent = defaultSiteContent
  const phone = normalizePhoneLink(siteContent.supportPhone) || defaultSiteContent.supportPhone
  const whatsappPhone = phone.replace('+', '')
  const whatsappMessage = encodeURIComponent(
    siteContent.supportWhatsappMessage || defaultSiteContent.supportWhatsappMessage
  )

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <p className="footer-title">{siteContent.supportLabel}</p>
        <p className="footer-contact">
          Contact:{' '}
          <a href={`tel:${phone}`} className="footer-link">
            {siteContent.supportPhone}
          </a>{' '}
          |{' '}
          <a
            href={`https://wa.me/${whatsappPhone}?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            WhatsApp
          </a>
        </p>
      </div>
    </footer>
  )
}

export default Footer
