import logoSrc from "@/assets/ccs-logo-full.png";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  size?: number;
  rounded?: boolean;
}

export function CcsLogo({ className, size = 40, rounded = true }: Props) {
  return (
    <img
      src={logoSrc}
      alt="CCS Student Council"
      width={size}
      height={size}
      loading="lazy"
      className={cn("object-cover", rounded && "rounded-lg", className)}
      style={{ width: size, height: size }}
    />
  );
}
