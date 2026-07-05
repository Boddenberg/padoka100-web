import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { Page } from "@/components/ui/Page";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateBlocks";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api/client";
import { cleanPayload } from "@/lib/utils/format";
import type { LocalVenda } from "@/types/api";

interface LocalDraft {
  nome: string;
  endereco_texto: string;
  descricao: string;
  url_imagem_principal: string;
  situacao?: string;
}

const emptyDraft: LocalDraft = {
  nome: "",
  endereco_texto: "",
  descricao: "",
  url_imagem_principal: "",
  situacao: "ativo"
};

export function LocationsPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<LocalDraft>(emptyDraft);
  const [editing, setEditing] = useState<LocalVenda | null>(null);
  const [editDraft, setEditDraft] = useState<LocalDraft>(emptyDraft);

  const locationsQuery = useQuery({
    queryKey: ["locais", "todos"],
    queryFn: () => api.locais.list(false)
  });

  const createLocation = useMutation({
    mutationFn: () => api.locais.create(cleanPayload(draft)),
    onSuccess: () => {
      setDraft(emptyDraft);
      queryClient.invalidateQueries({ queryKey: ["locais"] });
    }
  });

  const updateLocation = useMutation({
    mutationFn: () => api.locais.update(editing!.id, cleanPayload(editDraft)),
    onSuccess: () => {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["locais"] });
    }
  });

  function openEdit(local: LocalVenda) {
    setEditing(local);
    setEditDraft({
      nome: local.nome,
      endereco_texto: local.endereco_texto || "",
      descricao: local.descricao || "",
      url_imagem_principal: local.url_imagem_principal || "",
      situacao: local.situacao || "ativo"
    });
  }

  return (
    <Page title="Locais" eyebrow="Pontos de venda">
      <div className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-black text-bakery-ink">Novo local</h2>
          </CardHeader>
          <CardContent>
            <LocalForm
              value={draft}
              onChange={setDraft}
              onSubmit={() => createLocation.mutate()}
              submitting={createLocation.isPending}
              submitLabel="Criar local"
              error={createLocation.error instanceof Error ? createLocation.error.message : null}
            />
          </CardContent>
        </Card>

        <div className="grid gap-3">
          {locationsQuery.isLoading ? <LoadingState label="Carregando locais" /> : null}
          {locationsQuery.error instanceof Error ? <ErrorState message={locationsQuery.error.message} /> : null}
          {locationsQuery.data?.length ? (
            locationsQuery.data.map((local) => (
              <Card key={local.id}>
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <MapPin className="h-5 w-5 text-bakery-brand" />
                      <h2 className="text-xl font-black text-bakery-ink">{local.nome}</h2>
                      <StatusBadge tone={local.situacao === "ativo" ? "good" : "warn"}>{local.situacao}</StatusBadge>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-bakery-muted">{local.endereco_texto || "Sem endereco"}</p>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => openEdit(local)} icon={<Edit3 className="h-4 w-4" />}>
                    Editar
                  </Button>
                </CardContent>
              </Card>
            ))
          ) : !locationsQuery.isLoading ? (
            <EmptyState title="Nenhum local cadastrado" />
          ) : null}
        </div>
      </div>

      <Modal title="Editar local" open={Boolean(editing)} onClose={() => setEditing(null)}>
        <LocalForm
          value={editDraft}
          onChange={setEditDraft}
          onSubmit={() => updateLocation.mutate()}
          submitting={updateLocation.isPending}
          submitLabel="Salvar alteracoes"
          error={updateLocation.error instanceof Error ? updateLocation.error.message : null}
          includeStatus
        />
      </Modal>
    </Page>
  );
}

function LocalForm({
  value,
  onChange,
  onSubmit,
  submitting,
  submitLabel,
  error,
  includeStatus
}: {
  value: LocalDraft;
  onChange: (next: LocalDraft) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitLabel: string;
  error: string | null;
  includeStatus?: boolean;
}) {
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Field label="Nome">
        <Input required value={value.nome} onChange={(event) => onChange({ ...value, nome: event.target.value })} />
      </Field>
      <Field label="Endereco">
        <Input value={value.endereco_texto} onChange={(event) => onChange({ ...value, endereco_texto: event.target.value })} />
      </Field>
      <Field label="Descricao">
        <Textarea value={value.descricao} onChange={(event) => onChange({ ...value, descricao: event.target.value })} />
      </Field>
      <Field label="Imagem URL">
        <Input
          value={value.url_imagem_principal}
          onChange={(event) => onChange({ ...value, url_imagem_principal: event.target.value })}
        />
      </Field>
      {includeStatus ? (
        <Field label="Situacao">
          <Select value={value.situacao} onChange={(event) => onChange({ ...value, situacao: event.target.value })}>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </Select>
        </Field>
      ) : null}
      <Button type="submit" disabled={submitting} icon={<Plus className="h-4 w-4" />}>
        {submitting ? "Salvando" : submitLabel}
      </Button>
      {error ? <ErrorState message={error} /> : null}
    </form>
  );
}
