import { Building2, Package } from 'lucide-react';

export const SECTION_DEFINITIONS = [
  { key: 'agency', label: 'Agency' },
  { key: 'advisors', label: 'Advisors' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'destinations', label: 'Destinations' },
  { key: 'clients', label: 'Clients' },
  { key: 'inquiries', label: 'Inquiries' },
  { key: 'trips', label: 'Trips' },
  { key: 'providers', label: 'Payment providers' },
] as const;

export const TRAVEL_TEMPLATES = {
  full: { name: 'Full agency', description: 'Advisors, suppliers, clients, inquiries and nine trips across every status.', icon: <Building2 className="h-5 w-5" /> },
  minimal: { name: 'Minimal', description: 'One advisor, one supplier, one client and one trip with a proposal.', icon: <Package className="h-5 w-5" /> },
} as const;
