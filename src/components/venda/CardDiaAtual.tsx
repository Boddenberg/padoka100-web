import { CalendarDays, MapPin, TrendingUp } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import type { DiaDeVenda, ResumoDoDia } from "@/types/api";

interface CardDiaAtualProps {
  dia: DiaDeVenda;
  resumo?: ResumoDoDia;
}

export function CardDiaAtual({ dia, resumo }: CardDiaAtualProps) {
  const vendido = resumo?.total_vendido || 0;
  const produzido = resumo?.total_produzido || 0;
  const progresso = produzido > 0 ? Math.min(100, Math.round((vendido / produzido) * 100)) : 0;
  const isOpen = dia.situacao === "aberto";

  return (
    <section className="relative overflow-hidden rounded-bakeryXl bg-gradient-to-br from-bakery-brand via-bakery-brand to-bakery-dark p-5 text-white shadow-warm sm:p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-black/10 blur-2xl" />

      <div className="relative grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <span
            className={
              isOpen
                ? "inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm font-black text-bakery-success"
                : "inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm font-black text-bakery-warning"
            }
          >
            <span className={isOpen ? "h-2.5 w-2.5 rounded-full bg-bakery-success" : "h-2.5 w-2.5 rounded-full bg-bakery-warning"} />
            {isOpen ? "Dia aberto" : "Dia fechado"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-sm font-bold text-white">
            <CalendarDays className="h-4 w-4" />
            {formatDate(dia.data_venda)}
          </span>
        </div>

        <div className="min-w-0">
          <p className="text-base font-bold text-white/85">{getGreeting()}</p>
          <h1 className="mt-1 flex items-start gap-2 text-2xl font-black leading-tight sm:text-3xl">
            <MapPin className="mt-1 h-6 w-6 shrink-0 text-white/90" />
            <span className="line-clamp-2 break-words">{dia.nome_local_no_momento || "Local não informado"}</span>
          </h1>
        </div>

        <div className="rounded-bakeryLg bg-white/95 p-4 text-bakery-ink shadow-soft">
          {resumo ? (
            <div className="grid gap-3">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-bakery-muted">Vendas de hoje</p>
                  <p className="text-3xl font-black leading-none text-bakery-ink">{formatCurrency(resumo.faturamento_bruto)}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-bakery-successSoft px-3 py-1.5 text-sm font-black text-bakery-success">
                  <TrendingUp className="h-4 w-4" />
                  {progresso}%
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-bakery-cream ring-1 ring-bakery-border">
                <div className="h-full rounded-full bg-bakery-brand transition-all" style={{ width: `${progresso}%` }} />
              </div>
              <p className="text-sm font-bold text-bakery-muted">
                <span className="text-bakery-ink">{vendido}</span> de{" "}
                <span className="text-bakery-ink">{produzido}</span> itens vendidos
              </p>
            </div>
          ) : (
            <div className="grid gap-1">
              <p className="text-base font-black text-bakery-ink">Tudo pronto para vender!</p>
              <p className="text-sm font-semibold text-bakery-muted">Toque nos produtos abaixo e registre a primeira venda do dia.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia!";
  if (hour < 18) return "Boa tarde!";
  return "Boa noite!";
}
