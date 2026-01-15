export const NAV_LINKS = [
  { label: 'About', href: '/about' },
  { label: 'Services', href: '/services' },
  { label: 'Inventory', href: '/inventory' },
  { label: 'Repairs', href: '/repairs' },
  { label: 'Contact', href: '/contact' },
]

export const STATS = [
  { value: 15, suffix: '+', label: 'YEARS OF EXPERIENCE' },
  { value: 500, suffix: 'K+', label: 'PARTS AVAILABLE' },
  { value: 24, suffix: '/7', label: 'AOG SUPPORT' },
]

export const SERVICES = [
  {
    id: 'parts-brokerage',
    title: 'Sourcing & Sales',
    subtitle: 'PARTS BROKERAGE',
    description:
      'Instant access to a global network of certified parts. We find what you need, when you need it.',
    cta: 'Browse Catalog',
    href: '/inventory',
    featured: true,
  },
  {
    id: 'component-mro',
    title: 'Expert Repairs',
    subtitle: 'COMPONENT MRO',
    description:
      'FAA/EASA certified repair services with rapid turnaround times to keep your fleet flying.',
    cta: 'View Capabilities',
    href: '/repairs',
    featured: false,
  },
  {
    id: 'airline-supply',
    title: 'Fleet Solutions',
    subtitle: 'AIRLINE SUPPLY',
    description:
      'Tailored provisioning and supply chain programs for commercial and cargo operators.',
    cta: 'Learn More',
    href: '/contact',
    featured: false,
  },
]

export const ADVANTAGES = [
  {
    icon: 'Shield',
    title: 'FAA/EASA Certified',
    description: 'Full regulatory compliance with international aviation standards.',
  },
  {
    icon: 'Clock',
    title: 'Rapid Turnaround',
    description: 'Industry-leading response times to minimize aircraft downtime.',
  },
  {
    icon: 'Globe',
    title: 'Global Network',
    description: 'Worldwide partnerships ensuring access to any part, anywhere.',
  },
  {
    icon: 'Award',
    title: 'Quality Guaranteed',
    description: 'Every component certified, traced, and backed by our warranty.',
  },
]

export const FOOTER_LINKS = {
  quickLinks: [
    { label: 'Inventory', href: '#inventory' },
    { label: 'AOG Support', href: '#aog' },
    { label: 'About Us', href: '#about' },
    { label: 'Terms', href: '#terms' },
  ],
  contact: {
    address: '9565 NW 40th Street Rd, Doral',
    phone: '+1 (305) 555-0123',
    email: 'sales@genthrust.net',
  },
}

export const PARTNER_LOGOS = [
  { name: 'Partner 1', src: '/partners/partner1.png' },
  { name: 'Partner 2', src: '/partners/partner2.png' },
  { name: 'Partner 3', src: '/partners/partner3.png' },
  { name: 'Partner 4', src: '/partners/partner4.png' },
  { name: 'Partner 5', src: '/partners/partner5.png' },
]
