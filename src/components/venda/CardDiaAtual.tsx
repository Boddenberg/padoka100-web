import { CalendarDays, ClipboardList, Lock, MapPin, ReceiptText } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import type { DiaDeVenda, ResumoDoDia } from "@/types/api";

interface CardDiaAtualProps {
  dia: DiaDeVenda;
  resumo?: ResumoDoDia;
  onEditProduction?: () => void;
  onOpenSales?: () => void;
  onCloseDay?: () => void;
}

export function CardDiaAtual({ dia, resumo, onEditProduction, onOpenSales, onCloseDay }: CardDiaAtualProps) {
  const vendido = resumo?.total_vendido || 0;
  const produzido = resumo?.total_produzido || 0;
  const progresso = produzido > 0 ? Math.min(100, Math.round((vendido / produzido) * 100)) : 0;
  const isOpen = dia.situacao === "aberto";
  const hasActions = Boolean(onEditProduction || onOpenSales || onCloseDay);

  return (
    <section className="overflow-hidden rounded-bakeryXl bg-gradient-to-br from-[#26262a] to-[#18181b] p-5 text-white shadow-floating sm:p-6">
      <div className="grid gap-5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-bold">
            <span className={isOpen ? "h-2 w-2 rounded-full bg-emerald-400" : "h-2 w-2 rounded-full bg-amber-400"} />
            {isOpen ? "Dia aberto" : "Dia fechado"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white/85">
            <CalendarDays className="h-4 w-4" />
            {formatDate(dia.data_venda)}
          </span>
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-white/60">{getGreeting()}</p>
          <h1 className="mt-1 flex items-start gap-2 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
            <MapPin className="mt-1 h-6 w-6 shrink-0 text-white/60" />
            <span className="line-clamp-2 break-words">{dia.nome_local_no_momento || "Local não informado"}</span>
          </h1>
        </div>

        {resumo ? (
          <div className="grid gap-3">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white/60">Vendas de hoje</p>
                <p className="mt-1 text-4xl font-extrabold leading-none tracking-tight tabular-nums">
                  {formatCurrency(resumo.faturamento_bruto)}
                </p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold tabular-nums text-emerald-300">
                {progresso}%
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-bakery-brand transition-all" style={{ width: `${progresso}%` }} />
            </div>
            <p className="text-sm font-semibold text-white/60">
              <span className="font-bold text-white tabular-nums">{vendido}</span> de{" "}
              <span className="font-bold text-white tabular-nums">{produzido}</span> itens vendidos
            </p>
          </div>
        ) : (
          <div className="grid gap-1">
            <p className="text-base font-extrabold">Tudo pronto para vender!</p>
            <p className="text-sm font-semibold text-white/60">Toque nos produtos abaixo e registre a primeira venda do dia.</p>
          </div>
        )}

        {hasActions ? (
          <div className="flex flex-wrap gap-2">
            {onEditProduction ? (
              <HeroAction onClick={onEditProduction} icon={<ClipboardList className="h-4 w-4" />} label="Produção" />
            ) : null}
            {onOpenSales ? (
              <HeroAction onClick={onOpenSales} icon={<ReceiptText className="h-4 w-4" />} label="Vendas" />
            ) : null}
            {isOpen && onCloseDay ? (
              <HeroAction onClick={onCloseDay} icon={<Lock className="h-4 w-4" />} label="Fechar dia" />
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function HeroAction({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/20 active:scale-[0.97]"
    >
      {icon}
      {label}
    </button>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia!";
  if (hour < 18) return "Boa tarde!";
  return "Boa noite!";
}
