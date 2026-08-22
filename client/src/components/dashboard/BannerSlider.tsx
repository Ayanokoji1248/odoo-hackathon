"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Compass,
  MapPinned,
  Plane,
  Plus,
  Route,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { greeting } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

interface Slide {
  img: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: { label: string; href: string; icon?: boolean };
  secondary: { label: string; href: string };
  summary: string;
  metrics: Array<{ label: string; value: string }>;
  checklist: string[];
}

export function BannerSlider({ firstName }: { firstName: string }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);

  const slides: Slide[] = [
    {
      img: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1920&q=80",
      eyebrow: `${greeting()}, ${firstName}`,
      title: "Turn a rough idea into a ready trip.",
      subtitle:
        "Choose cities, map the route, estimate the budget, and share one clean plan with your group.",
      cta: { label: "Plan a trip", href: "/trips/create", icon: true },
      secondary: { label: "View my trips", href: "/trips" },
      summary: "Planning workspace",
      metrics: [
        { label: "Trip flow", value: "City to itinerary" },
        { label: "Budget", value: "One currency" },
      ],
      checklist: ["Pick destinations", "Set dates and budget", "Share the final link"],
    },
    {
      img: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1920&q=80",
      eyebrow: "Trending now",
      title: "Explore Europe's classics",
      subtitle:
        "London, Paris, Rome and beyond. Compare city ideas and stitch them into one memorable route.",
      cta: { label: "Explore cities", href: "/cities" },
      secondary: { label: "Open calendar", href: "/calendar" },
      summary: "City discovery",
      metrics: [
        { label: "Style", value: "Culture + food" },
        { label: "Pace", value: "Balanced" },
      ],
      checklist: ["Compare top cities", "Save the best ideas", "Build a multi-city route"],
    },
    {
      img: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1920&q=80",
      eyebrow: "Island escape",
      title: "Find your beach",
      subtitle:
        "Sun, surf and slow mornings. Discover activities that match the mood of your next getaway.",
      cta: { label: "Browse activities", href: "/activities" },
      secondary: { label: "Open community", href: "/community" },
      summary: "Activity finder",
      metrics: [
        { label: "Mood", value: "Relaxed" },
        { label: "Best for", value: "Groups" },
      ],
      checklist: ["Find experiences", "Add daily highlights", "Keep everyone aligned"],
    },
  ];

  const go = (dir: 1 | -1) => setIndex((i) => (i + dir + slides.length) % slides.length);
  const activeSlide = slides[index];
  const checklistIcons = [MapPinned, Route, WalletCards];

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(id);
  }, [slides.length]);

  return (
    <section className="relative isolate overflow-hidden bg-secondary">
      {slides.map((s, i) => (
        <div
          key={i}
          className={cn(
            "absolute inset-0 transition-opacity duration-700",
            i === index ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          aria-hidden={i !== index}
        >
          <Image src={s.img} alt="" fill priority={i === 0} sizes="100vw" className="scale-105 object-cover" />
        </div>
      ))}
      <div className="absolute inset-0 bg-linear-to-r from-secondary via-secondary/85 to-secondary/20" />
      <div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/10 to-transparent" />

      <div className="relative mx-auto grid min-h-[390px] max-w-7xl items-center gap-8 px-4 py-8 pb-16 sm:px-6 lg:min-h-[450px] lg:grid-cols-[1.08fr_0.92fr] lg:px-8">
        <div className="max-w-2xl text-white">
          <p
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/85 backdrop-blur"
            suppressHydrationWarning
          >
            <Plane className="h-3.5 w-3.5" />
            {activeSlide.eyebrow}
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl font-extrabold leading-[1.05] text-white sm:text-5xl lg:text-6xl">
            {activeSlide.title}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-white/82 sm:text-lg">{activeSlide.subtitle}</p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              className="bg-primary text-white shadow-xl shadow-primary/25 hover:bg-primary-hover"
              onClick={() => router.push(activeSlide.cta.href)}
            >
              {activeSlide.cta.icon && <Plus className="h-5 w-5" />}
              {activeSlide.cta.label}
            </Button>
            <Button
              size="lg"
              className="border border-white/25 bg-white/10 text-white backdrop-blur hover:bg-white/18"
              onClick={() => router.push(activeSlide.secondary.href)}
            >
              {activeSlide.secondary.label}
            </Button>
          </div>
        </div>

        <aside className="hidden rounded-2xl border border-white/18 bg-white/12 p-5 text-white shadow-2xl shadow-black/20 backdrop-blur-xl lg:block">
          <div className="flex items-start justify-between gap-4 border-b border-white/12 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">{activeSlide.summary}</p>
              <h2 className="mt-2 text-2xl font-bold leading-tight">Next best steps</h2>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {activeSlide.metrics.map((metric) => (
              <div key={metric.label} className="rounded-xl border border-white/12 bg-white/10 p-4">
                <p className="text-xs font-medium text-white/58">{metric.label}</p>
                <p className="mt-1 text-sm font-semibold text-white">{metric.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            {activeSlide.checklist.map((item, itemIndex) => {
              const Icon = checklistIcons[itemIndex] ?? Compass;
              return (
                <div key={item} className="flex items-center gap-3 rounded-xl bg-white/9 px-3 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/12 text-white">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium text-white/88">{item}</span>
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      <div className="absolute inset-x-0 bottom-4 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/20 p-1 backdrop-blur">
            {slides.map((s, i) => (
              <button
                key={s.summary}
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={cn(
                  "h-2.5 rounded-full transition-all",
                  i === index ? "w-10 bg-white" : "w-2.5 bg-white/45 hover:bg-white/75"
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => go(-1)}
              aria-label="Previous slide"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/18 bg-white/12 text-white backdrop-blur transition-colors hover:bg-white/22"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => go(1)}
              aria-label="Next slide"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/18 bg-white/12 text-white backdrop-blur transition-colors hover:bg-white/22"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}