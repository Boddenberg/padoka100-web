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
    <Card className="min-w-0 overflow-hidden border-none bg-gradient-to-br from-white via-white to-bakery-creamStrong/70">
      <CardContent className="grid min-w-0 gap-5 p-5">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <div className={isOpen ? "mb-3 inline-flex items-center gap-2 rounded-full bg-bakery-successSoft px-3 py-1.5 text-sm font-black text-bakery-success" : "mb-3 inline-flex items-center gap-2 rounded-full bg-bakery-warningSoft px-3 py-1.5 text-sm font-black text-bakery-warning"}>
              <span className={isOpen ? "h-2.5 w-2.5 rounded-full bg-bakery-success" : "h-2.5 w-2.5 rounded-full bg-bakery-warning"} />
              {isOpen ? "Dia aberto" : "Dia fechado"}
            </div>
            <p className="flex items-center gap-2 text-sm font-bold text-bakery-muted">
              <MapPin className="h-4 w-4" />
              Local da venda
            </p>
            <h2 className="mt-1 line-clamp-2 max-w-full break-words text-2xl font-black leading-tight text-bakery-ink">
              {dia.nome_local_no_momento || "Local nao informado"}
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InfoPill icon={<CalendarDays className="h-4 w-4" />} label="Hoje" value={formatDate(dia.data_venda)} />
          <InfoPill
            icon={<TrendingUp className="h-4 w-4" />}
            label="Vendido"
            value={resumo ? `${vendido}/${produzido}` : "Carregando"}
          />
        </div>

        {resumo ? (
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3 text-sm font-bold text-bakery-muted">
              <span>Progresso do dia</span>
              <span>{progresso}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white ring-1 ring-bakery-border">
              <div className="h-full rounded-full bg-bakery-brand transition-all" style={{ width: `${progresso}%` }} />
            </div>
            <p className="text-base font-black text-bakery-ink">{formatCurrency(resumo.faturamento_bruto)} em vendas</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function InfoPill({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-bakeryLg bg-white p-3 shadow-soft ring-1 ring-bakery-border/80">
      <p className="flex items-center gap-1.5 text-xs font-bold text-bakery-muted">{icon}{label}</p>
      <p className="mt-1 break-words text-base font-black text-bakery-ink">{value}</p>
    </div>
  );
}
