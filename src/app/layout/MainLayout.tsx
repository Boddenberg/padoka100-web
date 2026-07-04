import { useEffect, useState } from "react";
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
import { useApiSettings } from "@/lib/config/apiSettings";
import { cn } from "@/lib/utils/cn";
import { StatusBadge } from "@/components/ui/StatusBadge";

const navItems = [
  { to: "/", label: "Venda", icon: ShoppingBag, end: true },
  { to: "/abrir-dia", label: "Abrir", icon: CalendarPlus },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/locais", label: "Locais", icon: MapPin },
  { to: "/vendas", label: "Vendas", icon: ClipboardList },
  { to: "/relatorios", label: "Relatorios", icon: BarChart3 },
  { to: "/historico", label: "Historico", icon: History },
  { to: "/ia", label: "IA", icon: Bot },
  { to: "/configuracao", label: "Config", icon: Settings }
];

export function MainLayout() {
  const { settings, baseUrl } = useApiSettings();
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);

    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return (
    <div className="min-h-screen pb-20 lg:grid lg:grid-cols-[17rem_1fr] lg:pb-0">
      <aside className="hidden border-r border-slate-200 bg-white/92 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <Brand />
        <nav className="grid gap-1 p-3">
          {navItems.map((item) => (
            <DesktopNavLink key={item.to} {...item} />
          ))}
        </nav>
        <div className="mt-auto grid gap-2 border-t border-slate-100 p-4 text-xs font-semibold text-slate-500">
          <span className="truncate">{baseUrl}</span>
          <StatusBadge tone={settings.apiKey ? "good" : "warn"}>
            {settings.environment === "local" ? "Local" : "Railway"}
          </StatusBadge>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <Brand compact />
            <div className="flex flex-wrap justify-end gap-2">
              <StatusBadge tone={online ? "good" : "danger"}>{online ? "Online" : "Offline"}</StatusBadge>
              <StatusBadge tone={settings.apiKey ? "good" : "warn"}>
                {settings.environment === "local" ? "Local" : "Railway"}
              </StatusBadge>
            </div>
          </div>
        </header>

        <main className="min-h-screen">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex gap-1 overflow-x-auto border-t border-slate-200 bg-white/96 px-2 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-2 shadow-[0_-18px_50px_-34px_rgba(15,23,42,.5)] lg:hidden">
        {navItems.map((item) => (
          <MobileNavLink key={item.to} {...item} />
        ))}
      </nav>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", compact ? "" : "border-b border-slate-100 p-4")}>
      <img src="/padoka-mark.svg" alt="" className={cn("rounded-xl", compact ? "h-10 w-10" : "h-12 w-12")} />
      <div className="min-w-0">
        <p className={cn("font-black leading-none text-slate-950", compact ? "text-lg" : "text-xl")}>Padoka 100</p>
        {!compact ? <p className="mt-1 text-xs font-bold uppercase tracking-wide text-red-600">PWA de campo</p> : null}
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
          isActive ? "bg-red-50 text-red-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
        )
      }
    >
      <Icon className="h-5 w-5" />
      {label}
    </NavLink>
  );
}

function MobileNavLink({ to, label, icon: Icon, end }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "grid min-h-14 min-w-[4.8rem] justify-items-center gap-1 rounded-lg px-1 py-1 text-[0.72rem] font-bold transition",
          isActive ? "bg-red-50 text-red-700" : "text-slate-500"
        )
      }
    >
      <Icon className="h-5 w-5" />
      <span className="max-w-full truncate">{label}</span>
    </NavLink>
  );
}
