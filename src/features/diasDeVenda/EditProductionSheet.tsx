import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ErrorState, LoadingState } from "@/components/ui/StateBlocks";
import { ProductionEditor } from "@/components/dia/ProductionEditor";
import { buildProductionItems, type QuantityMap } from "@/lib/utils/production";
import { api } from "@/lib/api/client";
import type { DiaDeVenda } from "@/types/api";

interface EditProductionSheetProps {
  open: boolean;
  onClose: () => void;
  dia: DiaDeVenda;
}

export function EditProductionSheet({ open, onClose, dia }: EditProductionSheetProps) {
  const queryClient = useQueryClient();
  const [quantities, setQuantities] = useState<QuantityMap>({});

  const productsQuery = useQuery({
    queryKey: ["produtos", "ativos"],
    queryFn: () => api.produtos.list(true),
    enabled: open
  });

  const products = productsQuery.data || [];

  const productionByProduct = useMemo(() => {
    const map: QuantityMap = {};
    dia.itens_producao?.forEach((item) => {
      map[item.produto_id] = item.quantidade_produzida;
    });
    return map;
  }, [dia]);

  const visibleQuantities = { ...productionByProduct, ...quantities };

  const saveProduction = useMutation({
    mutationFn: async () => {
      const items = buildProductionItems(products, visibleQuantities, false);
      await Promise.all(items.map((item) => api.dias.saveProductionItem(dia.id, item)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dias"] });
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
      setQuantities({});
      onClose();
    }
  });

  return (
    <Modal
      title="Produção do dia"
      open={open}
      onClose={onClose}
      size="lg"
      footer={
        <div className="grid gap-2">
          <Button
            type="button"
            size="lg"
            disabled={saveProduction.isPending || dia.situacao !== "aberto"}
            onClick={() => saveProduction.mutate()}
            icon={<Save className="h-5 w-5" />}
          >
            {saveProduction.isPending ? "Salvando..." : "Salvar produção"}
          </Button>
          {saveProduction.error instanceof Error ? <ErrorState message={saveProduction.error.message} /> : null}
        </div>
      }
    >
      {productsQuery.isLoading ? <LoadingState label="Carregando produtos" /> : null}
      {productsQuery.error instanceof Error ? <ErrorState message={productsQuery.error.message} /> : null}
      {!productsQuery.isLoading && !productsQuery.error ? (
        <ProductionEditor products={products} quantities={visibleQuantities} onChange={setQuantities} />
      ) : null}
    </Modal>
  );
}
