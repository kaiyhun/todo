/**
 * Primary sidebar navigation. Kept separate from the auth route-protection list
 * (see `auth.config.ts`) because this one carries icons and is UI-only.
 */
import {
  LayoutDashboard,
  Columns3,
  ListTodo,
  BookOpen,
  Users,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Board", href: "/board", icon: Columns3 },
  { label: "Tasks", href: "/tasks", icon: ListTodo },
  { label: "Wiki", href: "/wiki", icon: BookOpen },
  { label: "Members", href: "/members", icon: Users },
  { label: "Settings", href: "/settings", icon: Settings },
];
