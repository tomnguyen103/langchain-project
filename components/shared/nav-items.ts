import {
  Activity,
  Briefcase,
  Calendar,
  CreditCard,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  PenSquare,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { label: string; items: NavItem[] };

// Navigation is consumed as groups (see DashboardNav); there is no flat export.

/**
 * Sidebar navigation, grouped by job-to-be-done. Review, Quality, and
 * Compliance live together under Governance (tabs); Brands and Team live
 * together under Workspace (tabs) — see app/(dashboard)/governance and
 * app/(dashboard)/workspace.
 */
export const navGroups: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/create", label: "Create", icon: PenSquare },
      { href: "/calendar", label: "Calendar", icon: Calendar },
      { href: "/campaigns", label: "Campaigns", icon: Megaphone },
    ],
  },
  {
    label: "Channels",
    items: [
      { href: "/accounts", label: "Accounts", icon: Share2 },
      { href: "/research", label: "Research", icon: Search },
      { href: "/auto-reply", label: "Auto-Reply", icon: MessageSquare },
    ],
  },
  {
    label: "Governance",
    items: [
      { href: "/governance", label: "Governance", icon: ShieldCheck },
      { href: "/runs", label: "Runs", icon: Activity },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/workspace", label: "Workspace", icon: Briefcase },
      { href: "/billing", label: "Billing", icon: CreditCard },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];
