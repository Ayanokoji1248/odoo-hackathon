import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { initials } from "@/lib/utils/format";

interface AvatarProps {
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-lg",
};

const px = { sm: 32, md: 40, lg: 64 };

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-light font-semibold text-primary-hover",
        sizes[size],
        className
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={name}
          width={px[size]}
          height={px[size]}
          className="h-full w-full object-cover"
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
