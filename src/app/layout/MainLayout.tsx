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
import { BottomNavigation } from "@/components/app/BottomNavigation";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { to: "/", label: "Venda", icon: ShoppingBag, end: true },
  { to: "/abrir-dia", label: "Abrir", icon: CalendarPlus },
  { to: "/produtos", label: "Produtos", mobileLabel: "Produto", icon: Package },
  { to: "/locais", label: "Locais", icon: MapPin },
  { to: "/vendas", label: "Vendas", icon: ClipboardList },
  { to: "/relatorios", label: "Relatorios", mobileLabel: "Resumo", icon: BarChart3 },
  { to: "/historico", label: "Historico", mobileLabel: "Histor.", icon: History },
  { to: "/ia", label: "IA", icon: Bot },
  { to: "/configuracao", label: "Config", mobileLabel: "Ajustes", icon: Settings }
];

export function MainLayout() {
  return (
    <div className="min-h-screen pb-[calc(var(--bottom-nav-height)+1rem)] lg:grid lg:grid-cols-[17rem_1fr] lg:pb-0">
      <aside className="hidden border-r border-bakery-border bg-white/90 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <Brand />
        <nav className="grid gap-1.5 p-4">
          {navItems.map((item) => (
            <DesktopNavLink key={item.to} {...item} />
          ))}
        </nav>
        <div className="mt-auto border-t border-bakery-border p-4">
          <p className="text-sm font-semibold leading-relaxed text-bakery-muted">
            Feito para vender rapido, com clareza e carinho.
          </p>
        </div>
      </aside>

      <div className="min-w-0">
        <AppHeader />

        <main className="min-h-screen">
          <Outlet />
        </main>
      </div>

      <BottomNavigation items={navItems} />
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 border-b border-bakery-border p-5">
      <img src="/padoka-mark.svg" alt="" className="h-12 w-12 rounded-bakeryLg shadow-soft" />
      <div className="min-w-0">
        <p className="text-xl font-black leading-tight text-bakery-ink">Padoka100</p>
        <p className="mt-1 text-sm font-semibold text-bakery-muted">App de vendas</p>
      </div>
    </div>
  );
}

type NavItemProps = (typeof navItems)[number];

function DesktopNavLink({ to, label, icon: Icon, end }: NavItemProps) {
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
