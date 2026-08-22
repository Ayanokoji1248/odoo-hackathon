import {
  Home,
  Luggage,
  Compass,
  Users,
  CalendarDays,
  Building2,
  Bookmark,
  Ticket,
  User,
  type LucideIcon,
} from "lucide-react";

export interface NavChild {
  label: string;
  href: string;
  icon?: LucideIcon;
  description?: string;
}

export interface NavItem {
  label: string;
  href?: string;
  icon: LucideIcon;
  children?: NavChild[];
}

/** Primary top-navigation menu (icon on top, label below; with dropdowns). */
export const topNav: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "My Trips", href: "/trips", icon: Luggage },
  {
    label: "Explore",
    icon: Compass,
    children: [
      { label: "Cities", href: "/cities", icon: Building2, description: "Browse destinations" },
      { label: "Activities", href: "/activities", icon: Ticket, description: "Things to do" },
      { label: "Saved", href: "/saved", icon: Bookmark, description: "Your bookmarks" },
    ],
  },
  { label: "Community", href: "/community", icon: Users },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
];

/** Condensed nav for the mobile bottom bar. */
export const bottomNav: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Trips", href: "/trips", icon: Luggage },
  { label: "Explore", href: "/cities", icon: Compass },
  { label: "Community", href: "/community", icon: Users },
  { label: "Profile", href: "/profile", icon: User },
];
