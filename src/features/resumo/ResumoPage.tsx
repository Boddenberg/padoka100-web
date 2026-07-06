import { useSearchParams } from "react-router-dom";
import { Page } from "@/components/ui/Page";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { HistoryPanel } from "@/features/historico/HistoryPanel";
import { ReportsPanel } from "@/features/relatorios/ReportsPanel";

type ResumoTab = "resumo" | "historico";

export function ResumoPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: ResumoTab = searchParams.get("tab") === "historico" ? "historico" : "resumo";

  return (
    <Page title="Resumo" eyebrow="Como foi o dia">
      <SegmentedControl
        value={tab}
        onChange={(next) => setSearchParams(next === "resumo" ? {} : { tab: next }, { replace: true })}
        options={[
          { value: "resumo", label: "Resumo" },
          { value: "historico", label: "Histórico" }
        ]}
        className="max-w-md"
      />
      {tab === "resumo" ? <ReportsPanel /> : <HistoryPanel />}
    </Page>
  );
}
