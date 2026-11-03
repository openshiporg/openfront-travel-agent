import { SECTION_DEFINITIONS } from '../config/templates';

export function getItemsFromJsonData(data: any, section: string): string[] {
  if (!data) return [];
  switch (section) {
    case 'agency': return [data.agency?.name || 'Agency'];
    case 'advisors': return (data.advisors || []).map((a: any) => a.name);
    case 'suppliers': return (data.suppliers || []).map((a: any) => a.name);
    case 'destinations': return (data.destinations || []).map((a: any) => a.name);
    case 'clients': return (data.clients || []).map((a: any) => a.name);
    case 'inquiries': return (data.inquiries || []).map((a: any) => a.name);
    case 'trips': return (data.trips || []).map((a: any) => a.title);
    case 'providers': return (data.paymentProviders || []).map((a: any) => a.name);
    default: return [];
  }
}

export function getSeedForTemplate(template: 'full' | 'minimal', seed: any) {
  if (template === 'full') return seed;
  const first = seed.clients[0];
  return {
    agency: seed.agency,
    advisors: seed.advisors.slice(0, 1),
    suppliers: seed.suppliers.slice(0, 1),
    destinations: seed.destinations.slice(0, 1),
    clients: [first],
    inquiries: [],
    trips: [{ title: 'First proposal' }],
    paymentProviders: seed.paymentProviders,
  };
}

export const emptyItems = () => Object.fromEntries(SECTION_DEFINITIONS.map((s) => [s.key, [] as string[]]));
