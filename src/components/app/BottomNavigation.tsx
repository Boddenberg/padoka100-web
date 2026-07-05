import { useEffect, useRef } from "react";
import type { ComponentType, Ref } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils/cn";

export interface BottomNavItem {
  to: string;
  label: string;
  mobileLabel?: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
}

export function BottomNavigation({ items }: { items: BottomNavItem[] }) {
  const location = useLocation();
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [location.pathname]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-bakery-border/80 bg-white/[0.97] px-0 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-1.5 shadow-nav backdrop-blur-xl lg:hidden">
      <div className="relative mx-auto w-full max-w-[22.25rem] overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-5 bg-gradient-to-r from-white to-white/0" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-5 bg-gradient-to-l from-white to-white/0" />

        <div className="flex snap-x snap-mandatory gap-1 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => {
            const active = isItemActive(item, location.pathname);

            return <MobileNavLink key={item.to} {...item} active={active} activeRef={active ? activeRef : undefined} />;
          })}
        </div>
      </div>
    </nav>
  );
}

function isItemActive(item: BottomNavItem, pathname: string) {
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function MobileNavLink({
  to,
  label,
  mobileLabel,
  icon: Icon,
  end,
  active,
  activeRef
}: BottomNavItem & { active: boolean; activeRef?: Ref<HTMLAnchorElement> }) {
  return (
    <NavLink
      to={to}
      end={end}
      ref={activeRef}
      className={cn(
        "grid min-h-[3.25rem] min-w-[4.25rem] snap-start place-items-center gap-0.5 rounded-bakeryMd px-2 py-1 text-[0.68rem] font-bold transition active:scale-95",
        active ? "bg-bakery-soft text-bakery-brand shadow-soft" : "text-bakery-muted hover:bg-bakery-cream"
      )}
    >
      <Icon className="h-[18px] w-[18px]" />
      <span className="max-w-full whitespace-nowrap">{mobileLabel || label}</span>
    </NavLink>
  );
}
