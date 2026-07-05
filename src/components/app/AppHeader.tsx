import { Settings } from "lucide-react";
import { Link } from "react-router-dom";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-bakery-border/70 bg-bakery-cream/88 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex min-h-[4.7rem] w-full min-w-0 max-w-[var(--sales-max-width)] items-center justify-between gap-3 px-4">
        <Link to="/" className="flex min-w-0 flex-1 items-center gap-3" aria-label="Ir para venda">
          <img src="/padoka-mark.svg" alt="" className="h-12 w-12 rounded-bakeryLg shadow-soft" />
          <div className="min-w-0">
            <p className="text-xl font-black leading-tight text-bakery-ink">Padoka100</p>
            <p className="truncate text-sm font-semibold text-bakery-muted">Vendas simples, todo dia</p>
          </div>
        </Link>

        <Link
          to="/configuracao"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-bakery-ink shadow-soft ring-1 ring-bakery-border transition active:scale-95"
          aria-label="Abrir configuracoes"
        >
          <Settings className="h-5 w-5" />
        </Link>
      </div>
    </header>
  );
}
