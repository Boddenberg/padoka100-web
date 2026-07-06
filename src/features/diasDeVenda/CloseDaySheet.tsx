import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DoorClosed } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { ErrorState } from "@/components/ui/StateBlocks";
import { api } from "@/lib/api/client";
import { formatDate } from "@/lib/utils/format";
import type { DiaDeVenda } from "@/types/api";

interface CloseDaySheetProps {
  open: boolean;
  onClose: () => void;
  dia: DiaDeVenda;
}

export function CloseDaySheet({ open, onClose, dia }: CloseDaySheetProps) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");

  const closeDay = useMutation({
    mutationFn: () => api.dias.close(dia.id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dias"] });
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
      setNotes("");
      onClose();
    }
  });

  return (
    <Modal title="Fechar o dia" open={open} onClose={onClose}>
      <div className="grid gap-4">
        <div className="rounded-bakeryLg bg-bakery-creamStrong/60 p-4">
          <p className="text-sm font-semibold text-bakery-muted">Dia de venda</p>
          <p className="text-xl font-extrabold text-bakery-ink">
            {formatDate(dia.data_venda)} · {dia.nome_local_no_momento || "Sem local"}
          </p>
        </div>
        <Field label="Observações finais">
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Como foi o dia?" />
        </Field>
        <Button
          type="button"
          variant="danger"
          size="lg"
          disabled={closeDay.isPending || dia.situacao !== "aberto"}
          onClick={() => closeDay.mutate()}
          icon={<DoorClosed className="h-5 w-5" />}
        >
          {closeDay.isPending ? "Fechando..." : "Fechar dia"}
        </Button>
        {closeDay.error instanceof Error ? <ErrorState message={closeDay.error.message} /> : null}
      </div>
    </Modal>
  );
}
