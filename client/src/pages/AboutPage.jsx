const aboutSections = [
  { id: 'vision', label: 'Vision' },
  { id: 'phase-one', label: 'Phase One' },
  { id: 'progress', label: 'Progress' },
  { id: 'features', label: 'Features' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'roadmap', label: 'Roadmap' },
]

const currentProgress = [
  'Supabase backend for auth, profiles, shops, products, orders, realtime updates, and push subscriptions.',
  'Public shop pages with short shop codes like GE-01 and a guest cart before checkout.',
  'Seller dashboards for business category setup, product posting, inventory, settings, and incoming orders.',
  'Buyer cart with quantities, shop subtotals, total calculation, delivery or pickup choice, and checkout notes.',
  'Delivery dashboard with boda, car, and truck categories plus delivery fee negotiation and confirmation code handoff.',
  'PWA/browser notifications for buyer, seller, and delivery order updates.',
  'Legacy Firebase admin area is still available while the main marketplace has moved to Supabase.',
]

const marketplaceFeatures = [
  {
    title: 'Sellers',
    body: 'Create a shop, choose a business category, add products or menu items, manage availability, and receive orders.',
  },
  {
    title: 'Buyers',
    body: 'Browse shops without an account, add products to cart, choose delivery or pickup, then sign in only at checkout.',
  },
  {
    title: 'Delivery',
    body: 'Delivery partners choose boda, car, truck, or all jobs, claim accepted orders, share live location, and confirm arrival with a code.',
  },
  {
    title: 'Cart',
    body: 'Multi-item cart with quantity controls, per-shop subtotals, total amount calculation, and grouped checkout orders.',
  },
  {
    title: 'Shop Codes',
    body: 'Each shop gets a cleaner public code using G plus the business category letter, for example GE-01.',
  },
  {
    title: 'Admin',
    body: 'Admin tools remain available for moderation, deployment support, site management, and platform oversight.',
  },
]

const upcomingFeatures = [
  'MTN Mobile Money and Airtel Money payments.',
  'Affiliate links, commission tracking, and mobile money payouts.',
  'Jobs board for formal work, informal work, and skilled youth services.',
  'Nearest-shop discovery using buyer location.',
  'Verified shop badges and premium shop placement.',
  'QR codes for each shop so sellers can print and share their storefront.',
  'AI recommendations, fraud detection, moderation support, and job matching.',
  'Community news, local ads, and business announcements.',
]

const roadmap = [
  {
    phase: 'Phase 01',
    title: 'Finish Garuga Marketplace',
    status: 'Build now',
    body: 'Launch the core marketplace on Garuga road with sellers, buyers, cart, delivery, admin tools, payments, affiliate earning, jobs, and verified shop discovery.',
  },
  {
    phase: 'Phase 02',
    title: 'Garuga AI OS',
    status: 'After phase one',
    body: 'Add AI agents for recommendations, fraud checks, job matching, seller support, automation, and platform intelligence.',
  },
  {
    phase: 'Phase 03',
    title: 'Garuga Super App',
    status: 'Future',
    body: 'Expand into rides, school pickup, local feed, chat, status, digital products, tutoring, streaming, and community services.',
  },
  {
    phase: 'Phase 04',
    title: 'Entebbe City OS',
    status: 'Long term',
    body: 'Scale from Garuga road to all of Entebbe, connecting every person, shop, skill, job, delivery, and service in one ecosystem.',
  },
]

function AboutPage() {
  return (
    <div className="about-page">
      <section id="vision" className="about-hero">
        <p className="market-eyebrow">Garuga Marketplace</p>
        <h2>One local platform for shops, buyers, delivery, jobs, and opportunity.</h2>
        <p>
          Garuga is starting as a marketplace for Garuga road, then growing into a city operating system for
          Entebbe. Phase one is about getting real shops, real buyers, real deliveries, and real income moving.
        </p>
      </section>

      <nav className="about-page-nav" aria-label="About page sections">
        {aboutSections.map((section) => (
          <a key={section.id} href={`#${section.id}`}>{section.label}</a>
        ))}
      </nav>

      <section id="phase-one" className="about-section about-phase-one">
        <div>
          <p className="market-eyebrow">Phase One</p>
          <h3>Finish Garuga Marketplace first.</h3>
          <p>
            Phase one is the foundation: sellers can build shops, buyers can order, delivery partners can earn,
            and the platform can start proving demand before the bigger super-app ideas are added.
          </p>
        </div>
        <div className="about-phase-card">
          <span>Phase 01 target</span>
          <strong>Marketplace, delivery, payments, affiliates, jobs, admin, and verified local discovery.</strong>
        </div>
      </section>

      <section id="progress" className="about-section">
        <div className="about-section-heading">
          <p className="market-eyebrow">Current Progress</p>
          <h3>What is already built or in progress</h3>
        </div>
        <div className="about-progress-list">
          {currentProgress.map((item) => (
            <article key={item}>
              <span>Live</span>
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="features" className="about-section">
        <div className="about-section-heading">
          <p className="market-eyebrow">Core Features</p>
          <h3>What users can expect from phase one</h3>
        </div>
        <div className="about-feature-grid">
          {marketplaceFeatures.map((feature) => (
            <article key={feature.title} className="about-feature-card">
              <h4>{feature.title}</h4>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="upcoming" className="about-section">
        <div className="about-section-heading">
          <p className="market-eyebrow">Upcoming</p>
          <h3>Remaining phase-one features</h3>
        </div>
        <div className="about-upcoming-grid">
          {upcomingFeatures.map((feature) => (
            <article key={feature}>{feature}</article>
          ))}
        </div>
      </section>

      <section id="roadmap" className="about-section">
        <div className="about-section-heading">
          <p className="market-eyebrow">Build Phases</p>
          <h3>The whole Garuga roadmap</h3>
        </div>
        <div className="about-roadmap">
          {roadmap.map((item) => (
            <article key={item.phase}>
              <span>{item.phase}</span>
              <h4>{item.title}</h4>
              <p>{item.body}</p>
              <strong>{item.status}</strong>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

export default AboutPage
