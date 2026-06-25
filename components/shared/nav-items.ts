import {
  Activity,
  Calendar,
  CreditCard,
  FileCheck,
  LayoutDashboard,
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

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/create", label: "Create", icon: PenSquare },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/accounts", label: "Accounts", icon: Share2 },
  { href: "/research", label: "Research", icon: Search },
  { href: "/auto-reply", label: "Auto-Reply", icon: MessageSquare },
  { href: "/review", label: "Review", icon: ShieldCheck },
  { href: "/quality", label: "Quality", icon: ShieldAlert },
  { href: "/runs", label: "Runs", icon: Activity },
  { href: "/compliance", label: "Compliance", icon: FileCheck },
  { href: "/team", label: "Team", icon: Users },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];
