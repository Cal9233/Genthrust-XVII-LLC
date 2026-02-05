export const NAV_LINKS = [
  { label: 'Inventory', href: '#search' },
  { label: 'About', href: '#credentials' },
  { label: 'Contact', href: '#contact' },
]

export const COMPANY_INFO = {
  name: 'GENTHRUST XVII LLC',
  tagline: 'Supplying aircraft parts and components of the highest quality',
  experience: '25+',
  experienceLabel: 'years of experience',
  description: 'We bring over 25 years of experience and capabilities across the full spectrum of the aircraft spares supply chain.',
  services: [
    'Same day delivery',
    'Competitive pricing',
    'Professional service',
    'Strong commitment to customer needs'
  ],
  location: 'Miami, Florida'
}

export const MISSION_VISION_VALUES = {
  mission: {
    title: 'Mission',
    text: 'Earning customer trust through quality products and competitive pricing.'
  },
  vision: {
    title: 'Vision',
    text: 'Dedicated to exceptional customer service with company spirit and pride.'
  },
  values: {
    title: 'Values',
    text: 'Accountability, fairness, and integrity in every interaction.'
  }
}

export const CREDENTIALS = [
  {
    icon: 'Globe',
    title: 'Global Reach',
    metric: '500+',
    metricLabel: 'certified suppliers',
    description: '24/7 AOG support network across 4 continents. We source when others can\'t.',
  },
  {
    icon: 'ShieldCheck',
    title: 'Verified Quality',
    metric: 'ASA-100',
    metricLabel: 'accredited',
    description: 'FAA AC 00-56B compliant. Full traceability on every component.',
  },
  {
    icon: 'Zap',
    title: 'Fast Response',
    metric: '2hr',
    metricLabel: 'quote turnaround',
    description: 'Average quote delivery time. AOG requests prioritized 24/7.',
  },
]

export const FEATURED_PARTS = [
  {
    id: '1',
    partNumber: 'CFM56-5B-P001',
    description: 'CFM56-5B Engine Fan Blade',
    condition: 'Overhauled',
    status: 'available',
    aircraft: 'A320 Family',
    image: '/parts/engine-blade.jpg',
  },
  {
    id: '2',
    partNumber: '65C-28957-1',
    description: 'APU Starter Generator',
    condition: 'Serviceable',
    status: 'available',
    aircraft: 'B737 NG',
    image: '/parts/starter-gen.jpg',
  },
  {
    id: '3',
    partNumber: 'AV2111-1',
    description: 'Flight Management Computer',
    condition: 'New',
    status: 'limited',
    aircraft: 'Multi-Type',
    image: '/parts/fmc.jpg',
  },
  {
    id: '4',
    partNumber: '141-00450-103',
    description: 'Landing Gear Actuator',
    condition: 'Overhauled',
    status: 'available',
    aircraft: 'B777',
    image: '/parts/actuator.jpg',
  },
]

export const CONDITION_OPTIONS = [
  { value: 'all', label: 'All Conditions' },
  { value: 'new', label: 'New (NE)' },
  { value: 'overhauled', label: 'Overhauled (OH)' },
  { value: 'serviceable', label: 'Serviceable (SV)' },
  { value: 'as-removed', label: 'As-Removed (AR)' },
]

export const AIRCRAFT_OPTIONS = [
  { value: 'all', label: 'All Aircraft' },
  { value: 'a320', label: 'Airbus A320 Family' },
  { value: 'a330', label: 'Airbus A330' },
  { value: 'b737', label: 'Boeing 737' },
  { value: 'b777', label: 'Boeing 777' },
  { value: 'b787', label: 'Boeing 787' },
]

export const FOOTER_LINKS = {
  quickLinks: [
    { label: 'Search Inventory', href: '#search' },
    { label: 'Request Quote', href: '#contact' },
    { label: 'About Us', href: '#credentials' },
  ],
  contact: {
    address: '9565 NW 40 St Road, Doral, FL 33178',
    phone: '+1 (305) 450-0191',
    email: 'sales@genthrust.net',
  },
}

export const CONTACT_INFO = {
  team: [
    { name: 'Jose Malagon', phone: '(305) 450-0191', email: 'jose@genthrust.net' },
    { name: 'Sandra Gallagher', phone: '(305) 797-9169', email: 'sandra@genthrust.net' },
  ],
  generalEmail: 'sales@genthrust.net',
  hours: {
    weekdays: 'Monday — Friday 9am – 5pm',
    saturday: 'Saturday — Closed',
    sunday: 'Sunday — Closed',
  },
  address: '9565 NW 40 St Road, Doral, FL 33178',
  mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3591.8!2d-80.3557!3d25.8085!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x88d9b9c5a5a5a5a5%3A0x0!2s9565%20NW%2040th%20St%20Rd%2C%20Doral%2C%20FL%2033178!5e0!3m2!1sen!2sus!4v1704067200000',
}
