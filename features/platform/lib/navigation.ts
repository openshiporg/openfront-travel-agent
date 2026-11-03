import { LayoutDashboard, Inbox, Plane, Percent, Users, Building2, FileText, ListChecks, CreditCard, Settings, LucideIcon } from 'lucide-react'

export interface PlatformNavItem {
  title: string
  href: string
  color: string
  description: string
  icon: LucideIcon
  group?: string
}

export interface PlatformNavGroup {
  id: string
  title: string
  icon: LucideIcon
  items: PlatformNavItem[]
}

export const platformNavItems: PlatformNavItem[] = [
  { title: 'Dashboard',   href: '/platform/overview',    color: 'blue',    description: 'Payments due, commissions, trips traveling now and open inquiries.', icon: LayoutDashboard, group: 'standalone' },
  { title: 'Inquiries',   href: '/platform/inquiries',   color: 'orange',  description: 'Lead pipeline from first contact to won or lost.',                   icon: Inbox,           group: 'standalone' },
  { title: 'Trips',       href: '/platform/trips',       color: 'teal',    description: 'Trip workspaces: proposals, components, itinerary and payments.',   icon: Plane,           group: 'standalone' },
  { title: 'Commissions', href: '/platform/commissions', color: 'emerald', description: 'Expected, received and short-paid supplier commissions.',            icon: Percent,         group: 'standalone' },
  { title: 'Invoices',    href: '/platform/invoices',    color: 'indigo',  description: 'Client invoices and collection status.',                             icon: FileText,        group: 'standalone' },
  { title: 'Tasks',       href: '/platform/tasks',       color: 'purple',  description: 'Payment reminders, passport checks and follow-ups.',                 icon: ListChecks,      group: 'standalone' },

  { title: 'Clients & Travelers', href: '/platform/clients',   color: 'cyan', description: 'Client households and their travelers.',                           icon: Users,     group: 'directory' },
  { title: 'Suppliers',           href: '/platform/suppliers', color: 'pink', description: 'Hotels, cruise lines, tour operators and their commission terms.', icon: Building2, group: 'directory' },

  { title: 'Payment Providers', href: '/platform/payment-providers', color: 'slate', description: 'Configure payment gateways.',                         icon: CreditCard, group: 'configuration' },
  { title: 'Settings',          href: '/platform/settings',          color: 'slate', description: 'Agency details, planning fee and host-agency split.', icon: Settings,   group: 'configuration' },
]

export const platformStandaloneItems = platformNavItems.filter((item) => item.group === 'standalone')

export const platformNavGroups: PlatformNavGroup[] = [
  { id: 'directory',     title: 'Directory',     icon: Users,    items: platformNavItems.filter((i) => i.group === 'directory') },
  { id: 'configuration', title: 'Configuration', icon: Settings, items: platformNavItems.filter((i) => i.group === 'configuration') },
]

export function getPlatformNavItemsWithBasePath(basePath: string) {
  return platformNavItems.map((item) => ({ ...item, href: `${basePath}${item.href}` }))
}
