import type { ComponentType } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils/cn";

export interface BottomNavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
}

export function BottomNavigation({ items }: { items: BottomNavItem[] }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-bakery-border/80 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.45rem)] pt-2 shadow-nav backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex w-full max-w-[var(--sales-max-width)] gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <MobileNavLink key={item.to} {...item} />
        ))}
      </div>
    </nav>
  );
}

function MobileNavLink({ to, label, icon: Icon, end }: BottomNavItem) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "grid min-h-[3.85rem] min-w-[4.9rem] flex-1 place-items-center gap-1 rounded-bakeryLg px-2 py-1 text-[0.76rem] font-bold transition active:scale-95",
          isActive ? "bg-bakery-soft text-bakery-brand shadow-soft" : "text-bakery-muted hover:bg-bakery-cream"
        )
      }
    >
      <Icon className="h-5 w-5" />
      <span className="max-w-full truncate">{label}</span>
    </NavLink>
  );
}
