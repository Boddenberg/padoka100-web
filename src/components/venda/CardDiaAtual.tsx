import type { ReactNode } from "react";
import { CalendarDays, MapPin, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
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
    <Card className="min-w-0 overflow-hidden border-none bg-gradient-to-br from-white via-white to-bakery-creamStrong/60">
      <CardContent className="grid min-w-0 gap-3 p-3.5 sm:p-4">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <div className={isOpen ? "mb-2 inline-flex items-center gap-1.5 rounded-full bg-bakery-successSoft px-2.5 py-1 text-xs font-black text-bakery-success" : "mb-2 inline-flex items-center gap-1.5 rounded-full bg-bakery-warningSoft px-2.5 py-1 text-xs font-black text-bakery-warning"}>
              <span className={isOpen ? "h-2 w-2 rounded-full bg-bakery-success" : "h-2 w-2 rounded-full bg-bakery-warning"} />
              {isOpen ? "Dia aberto" : "Dia fechado"}
            </div>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-bakery-muted">
              <MapPin className="h-3.5 w-3.5" />
              Local da venda
            </p>
            <h2 className="mt-0.5 line-clamp-1 max-w-full break-words text-xl font-black leading-tight text-bakery-ink sm:line-clamp-2 sm:text-2xl">
              {dia.nome_local_no_momento || "Local nao informado"}
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <InfoPill icon={<CalendarDays className="h-3.5 w-3.5" />} label="Hoje" value={formatDate(dia.data_venda)} />
          <InfoPill
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="Vendido"
            value={resumo ? `${vendido}/${produzido}` : "Carregando"}
          />
        </div>

        {resumo ? (
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-3 text-xs font-semibold text-bakery-muted">
              <span>Progresso do dia</span>
              <span>{progresso}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white ring-1 ring-bakery-border">
              <div className="h-full rounded-full bg-bakery-brand transition-all" style={{ width: `${progresso}%` }} />
            </div>
            <p className="text-sm font-black text-bakery-ink">{formatCurrency(resumo.faturamento_bruto)} em vendas</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function InfoPill({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-bakeryMd bg-white px-3 py-2 shadow-soft ring-1 ring-bakery-border/80">
      <p className="flex items-center gap-1.5 text-[0.72rem] font-semibold text-bakery-muted">{icon}{label}</p>
      <p className="mt-0.5 break-words text-sm font-black text-bakery-ink">{value}</p>
    </div>
  );
}
