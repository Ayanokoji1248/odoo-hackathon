import {
  Camera,
  UtensilsCrossed,
  Mountain,
  Landmark,
  ShoppingBag,
  Wine,
  Trees,
  Bus,
  Coffee,
  BedDouble,
  type LucideIcon,
} from "lucide-react";

/** Visual styling for itinerary item categories. */
export const categoryMeta: Record<string, { icon: LucideIcon; color: string; dot: string }> = {
  Sightseeing: { icon: Camera, color: "text-info bg-blue-50", dot: "bg-info" },
  Food: { icon: UtensilsCrossed, color: "text-secondary-hover bg-amber-50", dot: "bg-secondary" },
  Adventure: { icon: Mountain, color: "text-primary-hover bg-primary-light", dot: "bg-primary" },
  Culture: { icon: Landmark, color: "text-purple-600 bg-purple-50", dot: "bg-purple-500" },
  Shopping: { icon: ShoppingBag, color: "text-pink-600 bg-pink-50", dot: "bg-pink-500" },
  Nightlife: { icon: Wine, color: "text-indigo-600 bg-indigo-50", dot: "bg-indigo-500" },
  Nature: { icon: Trees, color: "text-success bg-green-50", dot: "bg-success" },
  Transport: { icon: Bus, color: "text-slate-600 bg-slate-100", dot: "bg-slate-500" },
  Meal: { icon: Coffee, color: "text-secondary-hover bg-amber-50", dot: "bg-secondary" },
  Rest: { icon: BedDouble, color: "text-slate-600 bg-slate-100", dot: "bg-slate-400" },
};

export function getCategoryMeta(category: string) {
  return categoryMeta[category] ?? categoryMeta.Sightseeing;
}

export const ITEM_CATEGORIES = Object.keys(categoryMeta);
