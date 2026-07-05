import { Settings } from "lucide-react";
import { Link } from "react-router-dom";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-bakery-border/70 bg-bakery-cream/88 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex min-h-16 w-full min-w-0 max-w-[var(--sales-max-width)] items-center justify-between gap-3 px-3.5">
        <Link to="/" className="flex min-w-0 flex-1 items-center gap-2.5" aria-label="Ir para venda">
          <img src="/padoka-mark.svg" alt="" className="h-10 w-10 rounded-bakeryMd shadow-soft" />
          <div className="min-w-0">
            <p className="text-lg font-black leading-tight text-bakery-ink">Padoka100</p>
            <p className="truncate text-xs font-semibold text-bakery-muted">Vendas simples, todo dia</p>
          </div>
        </Link>

        <Link
          to="/configuracao"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-bakery-muted shadow-soft ring-1 ring-bakery-border transition hover:text-bakery-ink active:scale-95"
          aria-label="Abrir configuracoes"
        >
          <Settings className="h-[18px] w-[18px]" />
        </Link>
      </div>
    </header>
  );
}
