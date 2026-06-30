import {
  Activity,
  Briefcase,
  Calendar,
  CreditCard,
  FileCheck,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  PenSquare,
  Search,
  Settings,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { label: string; items: NavItem[] };

// Navigation is consumed as groups (see DashboardNav); there is no flat export.

/**
 * Sidebar navigation, grouped by job-to-be-done. The mono group labels and the
 * grouping give the 15 destinations a scannable hierarchy.
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
      { href: "/review", label: "Review", icon: ShieldCheck },
      { href: "/quality", label: "Quality", icon: ShieldAlert },
      { href: "/runs", label: "Runs", icon: Activity },
      { href: "/compliance", label: "Compliance", icon: FileCheck },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/brands", label: "Brands", icon: Briefcase },
      { href: "/team", label: "Team", icon: Users },
      { href: "/billing", label: "Billing", icon: CreditCard },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];
