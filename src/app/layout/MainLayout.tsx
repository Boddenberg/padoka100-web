import { NavLink, Outlet } from "react-router-dom";
import {
  BarChart3,
  Bot,
  CalendarPlus,
  ClipboardList,
  History,
  MapPin,
  Package,
  Settings,
  ShoppingBag
} from "lucide-react";
import { AppHeader } from "@/components/app/AppHeader";
import { BottomNavigation, type BottomNavItem } from "@/components/app/BottomNavigation";
import { cn } from "@/lib/utils/cn";

const primaryNav: BottomNavItem[] = [
  { to: "/", label: "Venda", icon: ShoppingBag, end: true },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/relatorios", label: "Resumo", icon: BarChart3 }
];

const secondaryNav: BottomNavItem[] = [
  { to: "/abrir-dia", label: "Abrir dia", icon: CalendarPlus },
  { to: "/vendas", label: "Vendas do dia", icon: ClipboardList },
  { to: "/locais", label: "Locais de venda", icon: MapPin },
  { to: "/historico", label: "Histórico", icon: History },
  { to: "/ia", label: "Assistente de IA", icon: Bot },
  { to: "/configuracao", label: "Ajustes", icon: Settings }
];

const desktopNav = [...primaryNav, ...secondaryNav];

export function MainLayout() {
  return (
    <div className="min-h-screen pb-[calc(var(--bottom-nav-height)+1rem)] lg:grid lg:grid-cols-[17rem_1fr] lg:pb-0">
      <aside className="hidden border-r border-bakery-border bg-white/90 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <Brand />
        <nav className="grid gap-1.5 p-4">
          {desktopNav.map((item) => (
            <DesktopNavLink key={item.to} {...item} />
          ))}
        </nav>
        <div className="mt-auto border-t border-bakery-border p-4">
          <p className="text-sm font-semibold leading-relaxed text-bakery-muted">
            Feito para vender rápido, com clareza e carinho.
          </p>
        </div>
      </aside>

      <div className="min-w-0">
        <AppHeader />

        <main className="min-h-screen">
          <Outlet />
        </main>
      </div>

      <BottomNavigation primary={primaryNav} secondary={secondaryNav} />
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 border-b border-bakery-border p-5">
      <img src="/logo.png" alt="" className="h-12 w-12 rounded-bakeryLg object-cover shadow-soft" />
      <div className="min-w-0">
        <p className="text-xl font-black leading-tight text-bakery-ink">Padoka100</p>
        <p className="mt-1 text-sm font-semibold text-bakery-muted">App de vendas</p>
      </div>
    </div>
  );
}

function DesktopNavLink({ to, label, icon: Icon, end }: BottomNavItem) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-bold transition",
          isActive ? "bg-bakery-soft text-bakery-brand" : "text-bakery-muted hover:bg-bakery-cream hover:text-bakery-ink"
        )
      }
    >
      <Icon className="h-5 w-5" />
      {label}
    </NavLink>
  );
}
