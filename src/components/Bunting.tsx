export function Bunting({ className = "", variant = "dark" }: { className?: string; variant?: "dark" | "light" }) {
  return (
    <div
      className={`${variant === "light" ? "ccs-pennants-light" : "ccs-pennants"} animate-sway ${className}`}
      aria-hidden
    />
  );
}
