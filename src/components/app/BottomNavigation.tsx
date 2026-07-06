import type { ComponentType } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils/cn";

export interface BottomNavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
}

interface BottomNavigationProps {
  items: BottomNavItem[];
}

export function BottomNavigation({ items }: BottomNavigationProps) {
  const location = useLocation();

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+var(--bottom-nav-inset))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-bakery-border/60 bg-white/90 px-2 py-2 shadow-nav backdrop-blur-xl lg:hidden"
    >
      {items.map((item) => {
        const active = isItemActive(item, location.pathname);
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            aria-label={item.label}
            className={cn(
              "flex h-12 items-center justify-center rounded-full transition-all active:scale-95",
              active ? "gap-2 bg-bakery-brand px-5 text-white shadow-button" : "w-12 text-bakery-muted hover:text-bakery-ink"
            )}
          >
            <Icon className="h-6 w-6 shrink-0" />
            {active ? <span className="text-sm font-bold">{item.label}</span> : null}
          </NavLink>
        );
      })}
    </nav>
  );
}

function isItemActive(item: BottomNavItem, pathname: string) {
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}
