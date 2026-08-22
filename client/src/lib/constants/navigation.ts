import {
  LayoutDashboard,
  MapPinned,
  Compass,
  Users,
  CalendarDays,
  User,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Primary top-navigation links (match the wireframe screen flow). */
export const topNav: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Trips", href: "/trips", icon: MapPinned },
  { label: "Explore", href: "/cities", icon: Compass },
  { label: "Community", href: "/community", icon: Users },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
];

/** Condensed nav for the mobile bottom bar. */
export const bottomNav: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Trips", href: "/trips", icon: MapPinned },
  { label: "Explore", href: "/cities", icon: Compass },
  { label: "Community", href: "/community", icon: Users },
  { label: "Profile", href: "/profile", icon: User },
];
