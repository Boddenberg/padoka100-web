import { NavLink, Outlet } from "react-router-dom";
import { BarChart3, Package, Settings, ShoppingBag } from "lucide-react";
import { AppHeader } from "@/components/app/AppHeader";
import { BottomNavigation, type BottomNavItem } from "@/components/app/BottomNavigation";
import { cn } from "@/lib/utils/cn";

const mainNav: BottomNavItem[] = [
  { to: "/", label: "Venda", icon: ShoppingBag, end: true },
  { to: "/catalogo", label: "Catálogo", icon: Package },
  { to: "/resumo", label: "Resumo", icon: BarChart3 }
];

const desktopNav: BottomNavItem[] = [...mainNav, { to: "/ajustes", label: "Ajustes", icon: Settings }];

export function MainLayout() {
  return (
    <div className="min-h-screen pb-[calc(var(--bottom-nav-clearance)+1.25rem)] lg:grid lg:grid-cols-[17rem_1fr] lg:pb-0">
      <aside className="hidden border-r border-bakery-border bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <Brand />
        <nav className="grid gap-1 p-4">
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

      <BottomNavigation items={mainNav} />
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 border-b border-bakery-border p-5">
      <img src="/logo.png" alt="" className="h-12 w-12 rounded-2xl object-cover shadow-soft" />
      <div className="min-w-0">
        <p className="text-xl font-extrabold leading-tight tracking-tight text-bakery-ink">Padoka100</p>
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
          "flex min-h-12 items-center gap-3 rounded-full px-4 text-sm font-bold transition",
          isActive ? "bg-bakery-creamStrong text-bakery-ink" : "text-bakery-muted hover:bg-bakery-cream hover:text-bakery-ink"
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="h-5 w-5" />
          <span className="flex-1">{label}</span>
          {isActive ? <span className="h-2 w-2 rounded-full bg-bakery-brand" /> : null}
        </>
      )}
    </NavLink>
  );
}
