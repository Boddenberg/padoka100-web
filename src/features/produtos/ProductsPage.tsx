import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, ImagePlus, Save, Tag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { Page } from "@/components/ui/Page";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateBlocks";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api, createProductMediaForm } from "@/lib/api/client";
import { cleanPayload, formatCurrency, formatDate, productInitials, todayInputValue } from "@/lib/utils/format";
import { resolveMediaUrl } from "@/lib/utils/media";
import type { Produto } from "@/types/api";

interface ProductDraft {
  nome: string;
  descricao: string;
  descricao_visual: string;
  url_imagem_principal: string;
  cor_botao: string;
  ordem_exibicao: string;
  preco_venda: string;
  preco_custo: string;
  vigente_desde: string;
  motivo_preco: string;
  situacao?: string;
}

const emptyProductDraft: ProductDraft = {
  nome: "",
  descricao: "",
  descricao_visual: "",
  url_imagem_principal: "",
  cor_botao: "#ef4444",
  ordem_exibicao: "0",
  preco_venda: "",
  preco_custo: "0",
  vigente_desde: todayInputValue(),
  motivo_preco: "Preco inicial",
  situacao: "ativo"
};

export function ProductsPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ProductDraft>(emptyProductDraft);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [editDraft, setEditDraft] = useState<ProductDraft>(emptyProductDraft);
  const [priceDraft, setPriceDraft] = useState({ preco_venda: "", preco_custo: "0", vigente_desde: todayInputValue(), motivo: "" });
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const productsQuery = useQuery({
    queryKey: ["produtos", "todos"],
    queryFn: () => api.produtos.list(false)
  });

  const pricesQuery = useQuery({
    queryKey: ["produtos", editing?.id, "precos"],
    queryFn: () => api.produtos.prices(editing!.id),
    enabled: Boolean(editing)
  });

  const createProduct = useMutation({
    mutationFn: () => api.produtos.create(productCreatePayload(draft)),
    onSuccess: () => {
      setDraft(emptyProductDraft);
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    }
  });

  const updateProduct = useMutation({
    mutationFn: () => api.produtos.update(editing!.id, productUpdatePayload(editDraft)),
    onSuccess: () => {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    }
  });

  const createPrice = useMutation({
    mutationFn: () =>
      api.produtos.createPrice(editing!.id, {
        preco_venda: Number(priceDraft.preco_venda || 0),
        preco_custo: Number(priceDraft.preco_custo || 0),
        vigente_desde: priceDraft.vigente_desde || todayInputValue(),
        motivo: priceDraft.motivo || null
      }),
    onSuccess: () => {
      setPriceDraft({ preco_venda: "", preco_custo: "0", vigente_desde: todayInputValue(), motivo: "" });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    }
  });

  const uploadMedia = useMutation({
    mutationFn: () => api.produtos.uploadMedia(editing!.id, createProductMediaForm(uploadFile!)),
    onSuccess: () => {
      setUploadFile(null);
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    }
  });

  function openEdit(produto: Produto) {
    setEditing(produto);
    setEditDraft({
      nome: produto.nome,
      descricao: produto.descricao || "",
      descricao_visual: produto.descricao_visual || "",
      url_imagem_principal: produto.url_imagem_principal || "",
      cor_botao: produto.cor_botao || "#ef4444",
      ordem_exibicao: String(produto.ordem_exibicao || 0),
      preco_venda: produto.preco_atual?.preco_venda || "",
      preco_custo: produto.preco_atual?.preco_custo || "0",
      vigente_desde: produto.preco_atual?.vigente_desde || todayInputValue(),
      motivo_preco: "",
      situacao: produto.situacao || "ativo"
    });
  }

  return (
    <Page title="Produtos" eyebrow="Catalogo">
      <div className="grid gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold text-slate-950">Novo produto</h2>
          </CardHeader>
          <CardContent>
            <ProductForm
              value={draft}
              onChange={setDraft}
              onSubmit={() => createProduct.mutate()}
              submitting={createProduct.isPending}
              submitLabel="Criar produto"
              error={createProduct.error instanceof Error ? createProduct.error.message : null}
              includePrice
            />
          </CardContent>
        </Card>

        <div className="grid gap-3">
          {productsQuery.isLoading ? <LoadingState label="Carregando produtos" /> : null}
          {productsQuery.error instanceof Error ? <ErrorState message={productsQuery.error.message} /> : null}
          {productsQuery.data?.length ? (
            productsQuery.data.map((produto) => <ProductRow key={produto.id} produto={produto} onEdit={openEdit} />)
          ) : !productsQuery.isLoading ? (
            <EmptyState title="Nenhum produto cadastrado" />
          ) : null}
        </div>
      </div>

      <Modal title="Editar produto" open={Boolean(editing)} onClose={() => setEditing(null)}>
        <div className="grid gap-6">
          <ProductForm
            value={editDraft}
            onChange={setEditDraft}
            onSubmit={() => updateProduct.mutate()}
            submitting={updateProduct.isPending}
            submitLabel="Salvar produto"
            error={updateProduct.error instanceof Error ? updateProduct.error.message : null}
            includeStatus
          />

          <section className="grid gap-3 border-t border-slate-100 pt-4">
            <h3 className="text-lg font-bold text-slate-950">Nova versao de preco</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Venda">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={priceDraft.preco_venda}
                  onChange={(event) => setPriceDraft({ ...priceDraft, preco_venda: event.target.value })}
                />
              </Field>
              <Field label="Custo">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={priceDraft.preco_custo}
                  onChange={(event) => setPriceDraft({ ...priceDraft, preco_custo: event.target.value })}
                />
              </Field>
              <Field label="Vigente desde">
                <Input
                  type="date"
                  value={priceDraft.vigente_desde}
                  onChange={(event) => setPriceDraft({ ...priceDraft, vigente_desde: event.target.value })}
                />
              </Field>
            </div>
            <Field label="Motivo">
              <Input value={priceDraft.motivo} onChange={(event) => setPriceDraft({ ...priceDraft, motivo: event.target.value })} />
            </Field>
            <Button
              type="button"
              variant="secondary"
              disabled={createPrice.isPending || !priceDraft.preco_venda}
              onClick={() => createPrice.mutate()}
              icon={<Tag className="h-4 w-4" />}
            >
              {createPrice.isPending ? "Salvando preco" : "Criar preco"}
            </Button>
            {createPrice.error instanceof Error ? <ErrorState message={createPrice.error.message} /> : null}
          </section>

          <section className="grid gap-3 border-t border-slate-100 pt-4">
            <h3 className="text-lg font-bold text-slate-950">Foto do produto</h3>
            <Input
              type="file"
              accept="image/*"
              onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
              className="py-3"
            />
            <Button
              type="button"
              variant="secondary"
              disabled={uploadMedia.isPending || !uploadFile}
              onClick={() => uploadMedia.mutate()}
              icon={<ImagePlus className="h-4 w-4" />}
            >
              {uploadMedia.isPending ? "Enviando" : "Enviar foto"}
            </Button>
            {uploadMedia.error instanceof Error ? <ErrorState message={uploadMedia.error.message} /> : null}
          </section>

          <section className="grid gap-3 border-t border-slate-100 pt-4">
            <h3 className="text-lg font-bold text-slate-950">Historico de precos</h3>
            {pricesQuery.isLoading ? <LoadingState label="Carregando precos" /> : null}
            {pricesQuery.data?.length ? (
              <div className="grid gap-2">
                {pricesQuery.data.map((price) => (
                  <div key={price.id} className="grid gap-1 rounded-lg bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-black text-slate-950">{formatCurrency(price.preco_venda)}</span>
                      <span className="text-sm font-bold text-slate-500">{formatDate(price.vigente_desde)}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-500">Custo {formatCurrency(price.preco_custo)}</p>
                  </div>
                ))}
              </div>
            ) : !pricesQuery.isLoading ? (
              <EmptyState title="Sem historico" />
            ) : null}
          </section>
        </div>
      </Modal>
    </Page>
  );
}

function ProductRow({ produto, onEdit }: { produto: Produto; onEdit: (produto: Produto) => void }) {
  const image = resolveMediaUrl(produto.url_imagem_principal);
  const buttonColor = produto.cor_botao || "#ef4444";

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {image ? (
            <img src={image} alt="" className="h-16 w-16 rounded-lg object-cover" loading="lazy" />
          ) : (
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg text-xl font-black text-white" style={{ backgroundColor: buttonColor }}>
              {productInitials(produto.nome)}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black text-slate-950">{produto.nome}</h2>
              <StatusBadge tone={produto.situacao === "ativo" ? "good" : "warn"}>{produto.situacao}</StatusBadge>
            </div>
            <p className="text-sm font-semibold text-slate-500">{produto.descricao || produto.descricao_visual || "Sem descricao"}</p>
            <p className="mt-1 text-lg font-black text-teal-700">{formatCurrency(produto.preco_atual?.preco_venda)}</p>
          </div>
        </div>
        <Button type="button" variant="secondary" onClick={() => onEdit(produto)} icon={<Edit3 className="h-4 w-4" />}>
          Editar
        </Button>
      </CardContent>
    </Card>
  );
}

function ProductForm({
  value,
  onChange,
  onSubmit,
  submitting,
  submitLabel,
  error,
  includePrice,
  includeStatus
}: {
  value: ProductDraft;
  onChange: (next: ProductDraft) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitLabel: string;
  error: string | null;
  includePrice?: boolean;
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
      <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
        <Field label="Cor">
          <Input type="color" value={value.cor_botao} onChange={(event) => onChange({ ...value, cor_botao: event.target.value })} />
        </Field>
        <Field label="Ordem">
          <Input
            type="number"
            value={value.ordem_exibicao}
            onChange={(event) => onChange({ ...value, ordem_exibicao: event.target.value })}
          />
        </Field>
      </div>
      <Field label="Descricao">
        <Textarea value={value.descricao} onChange={(event) => onChange({ ...value, descricao: event.target.value })} />
      </Field>
      <Field label="Descricao visual">
        <Input value={value.descricao_visual} onChange={(event) => onChange({ ...value, descricao_visual: event.target.value })} />
      </Field>
      <Field label="Imagem URL">
        <Input
          value={value.url_imagem_principal}
          onChange={(event) => onChange({ ...value, url_imagem_principal: event.target.value })}
        />
      </Field>
      {includePrice ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Preco venda">
            <Input
              required
              type="number"
              min={0}
              step="0.01"
              value={value.preco_venda}
              onChange={(event) => onChange({ ...value, preco_venda: event.target.value })}
            />
          </Field>
          <Field label="Preco custo">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={value.preco_custo}
              onChange={(event) => onChange({ ...value, preco_custo: event.target.value })}
            />
          </Field>
          <Field label="Vigente desde">
            <Input
              type="date"
              value={value.vigente_desde}
              onChange={(event) => onChange({ ...value, vigente_desde: event.target.value })}
            />
          </Field>
        </div>
      ) : null}
      {includeStatus ? (
        <Field label="Situacao">
          <Select value={value.situacao} onChange={(event) => onChange({ ...value, situacao: event.target.value })}>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </Select>
        </Field>
      ) : null}
      <Button type="submit" disabled={submitting} icon={<Save className="h-4 w-4" />}>
        {submitting ? "Salvando" : submitLabel}
      </Button>
      {error ? <ErrorState message={error} /> : null}
    </form>
  );
}

function productCreatePayload(draft: ProductDraft) {
  return cleanPayload({
    nome: draft.nome,
    descricao: draft.descricao,
    descricao_visual: draft.descricao_visual,
    url_imagem_principal: draft.url_imagem_principal,
    cor_botao: draft.cor_botao,
    ordem_exibicao: Number(draft.ordem_exibicao || 0),
    preco_venda: Number(draft.preco_venda || 0),
    preco_custo: Number(draft.preco_custo || 0),
    vigente_desde: draft.vigente_desde || todayInputValue(),
    motivo_preco: draft.motivo_preco || "Preco inicial"
  });
}

function productUpdatePayload(draft: ProductDraft) {
  return cleanPayload({
    nome: draft.nome,
    descricao: draft.descricao,
    descricao_visual: draft.descricao_visual,
    url_imagem_principal: draft.url_imagem_principal,
    cor_botao: draft.cor_botao,
    ordem_exibicao: Number(draft.ordem_exibicao || 0),
    situacao: draft.situacao || "ativo"
  });
}
