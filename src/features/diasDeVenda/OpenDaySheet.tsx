import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { ErrorState, LoadingState } from "@/components/ui/StateBlocks";
import { ProductionEditor } from "@/components/dia/ProductionEditor";
import { buildProductionItems, type QuantityMap } from "@/lib/utils/production";
import { api } from "@/lib/api/client";
import { todayInputValue } from "@/lib/utils/format";

const openDaySchema = z.object({
  data_venda: z.string().min(1, "Informe a data."),
  local_id: z.string().optional(),
  nome_local: z.string().optional(),
  observacoes: z.string().optional()
});

type OpenDayForm = z.infer<typeof openDaySchema>;

interface OpenDaySheetProps {
  open: boolean;
  onClose: () => void;
}

export function OpenDaySheet({ open, onClose }: OpenDaySheetProps) {
  return (
    <Modal title="Abrir dia de venda" open={open} onClose={onClose} size="full">
      {open ? <OpenDayContent onClose={onClose} /> : null}
    </Modal>
  );
}

function OpenDayContent({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [quantities, setQuantities] = useState<QuantityMap>({});
  const form = useForm<OpenDayForm>({
    resolver: zodResolver(openDaySchema),
    defaultValues: {
      data_venda: todayInputValue(),
      local_id: "",
      nome_local: "",
      observacoes: ""
    }
  });

  const productsQuery = useQuery({
    queryKey: ["produtos", "ativos"],
    queryFn: () => api.produtos.list(true)
  });
  const locationsQuery = useQuery({
    queryKey: ["locais", "ativos"],
    queryFn: () => api.locais.list(true)
  });

  const products = productsQuery.data || [];

  const createDay = useMutation({
    mutationFn: (values: OpenDayForm) =>
      api.dias.create({
        data_venda: values.data_venda,
        local_id: values.local_id || null,
        nome_local: values.local_id ? null : values.nome_local || null,
        observacoes: values.observacoes || null,
        itens_producao: buildProductionItems(products, quantities, true)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dias"] });
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
      onClose();
    }
  });

  if (productsQuery.isLoading || locationsQuery.isLoading) {
    return <LoadingState label="Carregando dia" />;
  }

  const loadError = productsQuery.error || locationsQuery.error;
  if (loadError) {
    return <ErrorState message={loadError instanceof Error ? loadError.message : "Erro ao carregar dados."} />;
  }

  return (
    <form className="grid grid-cols-1 gap-4" onSubmit={form.handleSubmit((values) => createDay.mutate(values))}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Data" error={form.formState.errors.data_venda?.message}>
          <Input type="date" {...form.register("data_venda")} />
        </Field>
        <Field label="Local salvo">
          <Select {...form.register("local_id")}>
            <option value="">Digitar local</option>
            {(locationsQuery.data || []).map((local) => (
              <option key={local.id} value={local.id}>
                {local.nome}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nome do local">
          <Input placeholder="Feira, evento, rua..." {...form.register("nome_local")} />
        </Field>
      </div>
      <Field label="Observações">
        <Textarea {...form.register("observacoes")} />
      </Field>

      <div>
        <h3 className="text-lg font-extrabold text-bakery-ink">Produção de hoje</h3>
        <p className="mb-3 text-sm font-semibold text-bakery-muted">Quantos itens você preparou de cada produto?</p>
        <ProductionEditor products={products} quantities={quantities} onChange={setQuantities} />
      </div>

      <Button type="submit" size="lg" disabled={createDay.isPending} icon={<CalendarCheck className="h-5 w-5" />}>
        {createDay.isPending ? "Abrindo..." : "Abrir dia"}
      </Button>
      {createDay.error instanceof Error ? <ErrorState message={createDay.error.message} /> : null}
    </form>
  );
}
