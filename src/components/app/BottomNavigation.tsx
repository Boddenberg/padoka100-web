import { useState } from "react";
import type { ComponentType } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils/cn";

export interface BottomNavItem {
  to: string;
  label: string;
  mobileLabel?: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
}

interface BottomNavigationProps {
  primary: BottomNavItem[];
  secondary: BottomNavItem[];
}

export function BottomNavigation({ primary, secondary }: BottomNavigationProps) {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = secondary.some((item) => isItemActive(item, location.pathname));

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-bakery-border/80 bg-white/[0.97] pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-1.5 shadow-nav backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1 px-2">
          {primary.map((item) => (
            <MobileNavLink key={item.to} {...item} active={isItemActive(item, location.pathname)} />
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "grid min-h-[3.5rem] place-items-center gap-1 rounded-bakeryMd px-1 py-1.5 text-xs font-bold transition active:scale-95",
              moreActive ? "text-bakery-brand" : "text-bakery-muted"
            )}
            aria-label="Ver mais opções"
          >
            <span className={cn("grid h-8 w-14 place-items-center rounded-full transition", moreActive ? "bg-bakery-soft" : "")}>
              <MoreHorizontal className="h-6 w-6" />
            </span>
            <span>Mais</span>
          </button>
        </div>
      </nav>

      <Modal title="Mais opções" open={moreOpen} onClose={() => setMoreOpen(false)}>
        <div className="grid gap-2">
          {secondary.map((item) => {
            const active = isItemActive(item, location.pathname);
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex min-h-[3.75rem] items-center gap-3.5 rounded-bakeryLg px-3 text-lg font-bold transition active:scale-[0.99]",
                  active ? "bg-bakery-soft text-bakery-brand" : "bg-bakery-cream text-bakery-ink"
                )}
              >
                <span
                  className={cn(
                    "grid h-12 w-12 shrink-0 place-items-center rounded-full",
                    active ? "bg-white text-bakery-brand" : "bg-white text-bakery-muted"
                  )}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <span className="flex-1">{item.label}</span>
                <ChevronRight className="h-5 w-5 text-bakery-muted" />
              </NavLink>
            );
          })}
        </div>
      </Modal>
    </>
  );
}

function isItemActive(item: BottomNavItem, pathname: string) {
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function MobileNavLink({ to, label, mobileLabel, icon: Icon, end, active }: BottomNavItem & { active: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={cn(
        "grid min-h-[3.5rem] place-items-center gap-1 rounded-bakeryMd px-1 py-1.5 text-xs font-bold transition active:scale-95",
        active ? "text-bakery-brand" : "text-bakery-muted"
      )}
    >
      <span className={cn("grid h-8 w-14 place-items-center rounded-full transition", active ? "bg-bakery-soft" : "")}>
        <Icon className="h-6 w-6" />
      </span>
      <span className="max-w-full truncate">{mobileLabel || label}</span>
    </NavLink>
  );
}
