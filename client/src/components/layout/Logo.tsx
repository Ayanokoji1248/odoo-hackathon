"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

type Size = "sm" | "md" | "lg";

const iconPx: Record<Size, number> = { sm: 30, md: 36, lg: 48 };
const textCls: Record<Size, string> = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-2xl",
};
// Height of the raster lockup per size.
const imgH: Record<Size, string> = { sm: "h-7", md: "h-8", lg: "h-11" };

/** Path to a raster logo lockup. Drop your file here to use it; falls back to the SVG. */
const LOGO_SRC = "/logo.png";

/** The GlobeTrotter globe + red orbital-ring mark, as scalable SVG. */
export function LogoMark({
  size = 36,
  tone = "dark",
  className,
}: {
  size?: number;
  tone?: "dark" | "light";
  className?: string;
}) {
  const globe = tone === "light" ? "#ffffff" : "#2b2b2b";
  const lines = tone === "light" ? "#2b2b2b" : "#ffffff";
  const lineOpacity = tone === "light" ? 0.35 : 0.55;
  const uid = tone;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn("shrink-0 overflow-visible", className)}
      role="img"
      aria-label="GlobeTrotter"
    >
      <defs>
        <clipPath id={`gt-globe-${uid}`}>
          <circle cx="50" cy="50" r="25" />
        </clipPath>
      </defs>
      <g transform="rotate(-20 50 50)">
        <path d="M5 50 A45 15 0 0 0 95 50" fill="none" stroke="#E11D2A" strokeWidth="7" strokeLinecap="round" />
      </g>
      <circle cx="50" cy="50" r="25" fill={globe} />
      <g clipPath={`url(#gt-globe-${uid})`} fill="none" stroke={lines} strokeOpacity={lineOpacity} strokeWidth="1.7">
        <ellipse cx="50" cy="50" rx="9" ry="25" />
        <ellipse cx="50" cy="50" rx="19" ry="25" />
        <line x1="25" y1="50" x2="75" y2="50" />
        <path d="M27 37 Q50 31 73 37" />
        <path d="M27 63 Q50 69 73 63" />
      </g>
      <g transform="rotate(-20 50 50)">
        <path d="M5 50 A45 15 0 0 1 95 50" fill="none" stroke="#E11D2A" strokeWidth="7" strokeLinecap="round" />
        <path d="M11 43 A41 13 0 0 1 91 43" fill="none" stroke="#E11D2A" strokeOpacity="0.85" strokeWidth="2.6" strokeLinecap="round" />
      </g>
    </svg>
  );
}

interface LogoProps {
  className?: string;
  href?: string;
  size?: Size;
  showText?: boolean;
  tone?: "dark" | "light";
}

export function Logo({
  className,
  href = "/dashboard",
  size = "md",
  showText = true,
  tone = "dark",
}: LogoProps) {
  // SVG is always shown by default (never a broken image). We probe /logo.png;
  // only if it actually loads do we swap to the raster lockup.
  const [rasterOk, setRasterOk] = useState(false);

  useEffect(() => {
    const probe = new window.Image();
    probe.onload = () => {
      if (probe.naturalWidth > 0) setRasterOk(true);
    };
    probe.src = LOGO_SRC;
  }, []);

  return (
    <Link href={href} className={cn("flex items-center gap-1.5", className)}>
      {rasterOk ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={LOGO_SRC} alt="GlobeTrotter" className={cn("w-auto", imgH[size])} />
      ) : (
        <>
          <LogoMark size={iconPx[size]} tone={tone} />
          {showText && (
            <span
              className={cn(
                "font-display font-extrabold italic tracking-tight",
                tone === "light" ? "text-white" : "text-[#2b2b2b]",
                textCls[size]
              )}
            >
              Globe<span className="text-[#E11D2A]">Trotter</span>
            </span>
          )}
        </>
      )}
    </Link>
  );
}
