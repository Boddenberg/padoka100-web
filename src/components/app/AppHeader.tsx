import { Settings } from "lucide-react";
import { Link } from "react-router-dom";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 bg-bakery-cream/85 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex min-h-[4.25rem] w-full min-w-0 max-w-[var(--sales-max-width)] items-center justify-between gap-3 px-4">
        <Link to="/" className="flex min-w-0 flex-1 items-center gap-3" aria-label="Ir para a tela de venda">
          <img src="/logo.png" alt="" className="h-11 w-11 rounded-2xl object-cover shadow-soft" />
          <div className="min-w-0">
            <p className="text-lg font-extrabold leading-tight tracking-tight text-bakery-ink">Padoka100</p>
            <p className="truncate text-xs font-semibold text-bakery-muted">Vender é só tocar e pronto</p>
          </div>
        </Link>

        <Link
          to="/ajustes"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-bakery-border bg-white text-bakery-muted transition hover:text-bakery-ink active:scale-95"
          aria-label="Abrir ajustes"
        >
          <Settings className="h-5 w-5" />
        </Link>
      </div>
    </header>
  );
}
