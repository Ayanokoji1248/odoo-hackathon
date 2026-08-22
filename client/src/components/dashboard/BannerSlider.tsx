"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { greeting } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

interface Slide {
  img: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: { label: string; href: string; icon?: boolean };
}

export function BannerSlider({ firstName }: { firstName: string }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);

  const slides: Slide[] = [
    {
      img: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1920&q=80",
      eyebrow: `${greeting()}, ${firstName} 👋`,
      title: "Where will you go next?",
      subtitle: "Discover destinations, build day-by-day itineraries, and keep every trip on budget.",
      cta: { label: "Plan a trip", href: "/trips/create", icon: true },
    },
    {
      img: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1920&q=80",
      eyebrow: "Trending now",
      title: "Explore Europe's classics",
      subtitle: "London, Paris, Rome and beyond — stitch them into one unforgettable trip.",
      cta: { label: "Explore cities", href: "/cities" },
    },
    {
      img: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1920&q=80",
      eyebrow: "Island escape",
      title: "Find your beach",
      subtitle: "Sun, surf and slow mornings — plan the getaway you deserve.",
      cta: { label: "Browse activities", href: "/activities" },
    },
  ];

  const go = (dir: 1 | -1) => setIndex((i) => (i + dir + slides.length) % slides.length);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(id);
  }, [slides.length]);

  return (
    <section className="relative h-72 overflow-hidden sm:h-80 lg:h-[440px]">
      {slides.map((s, i) => (
        <div
          key={i}
          className={cn(
            "absolute inset-0 transition-opacity duration-700",
            i === index ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          aria-hidden={i !== index}
        >
          <Image src={s.img} alt="" fill priority={i === 0} sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-linear-to-r from-slate-900/80 via-slate-900/40 to-transparent" />
          <div className="mx-auto flex h-full max-w-7xl flex-col justify-center px-6 lg:px-8">
            <p className="text-sm font-medium text-white/85" suppressHydrationWarning>{s.eyebrow}</p>
            <h1 className="mt-1 max-w-xl text-display text-white">{s.title}</h1>
            <p className="mt-2 max-w-md text-white/85">{s.subtitle}</p>
            <div className="mt-5">
              <Button size="lg" className="bg-white text-primary-hover hover:bg-white/90" onClick={() => router.push(s.cta.href)}>
                {s.cta.icon && <Plus className="h-5 w-5" />}
                {s.cta.label}
              </Button>
            </div>
          </div>
        </div>
      ))}

      <button onClick={() => go(-1)} aria-label="Previous slide" className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur transition-colors hover:bg-white/40 lg:left-6">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button onClick={() => go(1)} aria-label="Next slide" className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur transition-colors hover:bg-white/40 lg:right-6">
        <ChevronRight className="h-5 w-5" />
      </button>

      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
        {slides.map((_, i) => (
          <button key={i} onClick={() => setIndex(i)} aria-label={`Go to slide ${i + 1}`} className={cn("h-1.5 rounded-full transition-all", i === index ? "w-7 bg-white" : "w-2.5 bg-white/50 hover:bg-white/80")} />
        ))}
      </div>
    </section>
  );
}
