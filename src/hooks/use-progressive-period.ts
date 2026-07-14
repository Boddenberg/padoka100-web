import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toNumber } from "@/lib/format";
import type { ResumoPeriodoLeve } from "@/types/api";
import { addDays, startOfMonth } from "@/utils/dates";

export interface PeriodChunk {
  start: string;
  end: string;
}

interface ProgressivePeriodState {
  data?: ResumoPeriodoLeve;
  loadedChunks: number;
  totalChunks: number;
  currentChunk?: PeriodChunk;
  isLoading: boolean;
  error: Error | null;
}

export function splitIntoMonthsNewestFirst(start: string, end: string): PeriodChunk[] {
  const chunks: PeriodChunk[] = [];
  let cursorEnd = end;
  while (cursorEnd >= start) {
    const monthStart = startOfMonth(cursorEnd);
    const chunkStart = monthStart < start ? start : monthStart;
    chunks.push({ start: chunkStart, end: cursorEnd });
    cursorEnd = addDays(chunkStart, -1);
  }
  return chunks;
}

export function mergeCompactPeriods(
  periods: ResumoPeriodoLeve[],
  start: string,
  end: string
): ResumoPeriodoLeve {
  const days = periods
    .flatMap((period) => period.dias || [])
    .sort((first, second) => first.data_venda.localeCompare(second.data_venda));
  return {
    data_inicio: start,
    data_fim: end,
    faturamento_bruto: periods.reduce((total, period) => total + toNumber(period.faturamento_bruto), 0),
    lucro_estimado: periods.reduce((total, period) => total + toNumber(period.lucro_estimado), 0),
    total_vendido: periods.reduce((total, period) => total + Number(period.total_vendido || 0), 0),
    total_sobra: periods.reduce((total, period) => total + Number(period.total_sobra || 0), 0),
    dias: days
  };
}

export function useProgressivePeriod(
  start: string,
  end: string,
  options: { enabled?: boolean; includeDays?: boolean } = {}
) {
  const enabled = options.enabled ?? true;
  const includeDays = options.includeDays ?? true;
  const queryClient = useQueryClient();
  const chunks = useMemo(() => splitIntoMonthsNewestFirst(start, end), [start, end]);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [state, setState] = useState<ProgressivePeriodState>({
    loadedChunks: 0,
    totalChunks: chunks.length,
    isLoading: true,
    error: null
  });

  useEffect(() => {
    let cancelled = false;
    const loaded: ResumoPeriodoLeve[] = [];

    if (!enabled) {
      setState({
        loadedChunks: 0,
        totalChunks: chunks.length,
        isLoading: false,
        error: null
      });
      return () => {
        cancelled = true;
      };
    }

    setState({
      loadedChunks: 0,
      totalChunks: chunks.length,
      currentChunk: chunks[0],
      isLoading: chunks.length > 0,
      error: null
    });

    async function load() {
      try {
        for (const chunk of chunks) {
          if (cancelled) return;
          setState((current) => ({ ...current, currentChunk: chunk }));
          const result = await queryClient.fetchQuery({
            queryKey: ["relatorios", "periodo-compacto", includeDays, chunk.start, chunk.end],
            queryFn: () => api.relatorios.periodResumo(chunk.start, chunk.end, false, includeDays),
            staleTime: 0,
            retry: 2
          });
          if (cancelled) return;
          if (!result) throw new Error("O resumo compacto ainda nao esta disponivel.");
          loaded.push(result);
          setState({
            data: mergeCompactPeriods(loaded, start, end),
            loadedChunks: loaded.length,
            totalChunks: chunks.length,
            currentChunk: chunks[loaded.length],
            isLoading: loaded.length < chunks.length,
            error: null
          });
        }
      } catch (error) {
        if (cancelled) return;
        setState((current) => ({
          ...current,
          isLoading: false,
          error: error instanceof Error ? error : new Error("Nao foi possivel carregar o periodo.")
        }));
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [chunks, enabled, end, includeDays, queryClient, reloadVersion, start]);

  const reload = useCallback(() => setReloadVersion((current) => current + 1), []);
  return {
    ...state,
    isComplete: state.totalChunks > 0 && state.loadedChunks === state.totalChunks && !state.error,
    reload
  };
}
