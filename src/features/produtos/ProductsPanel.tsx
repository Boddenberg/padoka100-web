import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, ImagePlus, Plus, Save, Tag, Wheat } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateBlocks";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api, createProductMediaForm } from "@/lib/api/client";
import { cleanPayload, formatCurrency, formatDate, todayInputValue } from "@/lib/utils/format";
import { resolveMediaUrl } from "@/lib/utils/media";
import type { Produto } from "@/types/api";

interface ProductDraft {
  nome: string;
  descricao: string;
  url_imagem_principal: string;
  cor_botao: string;
  ordem_exibicao: string;
  preco_venda: string;
  preco_custo: string;
  motivo_preco: string;
  imagem_file: File | null;
  situacao?: string;
}

const emptyProductDraft: ProductDraft = {
  nome: "",
  descricao: "",
  url_imagem_principal: "",
  cor_botao: "#ef4444",
  ordem_exibicao: "0",
  preco_venda: "",
  preco_custo: "0",
  motivo_preco: "Preco inicial",
  imagem_file: null,
  situacao: "ativo"
};

export function ProductsPanel() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<ProductDraft>(emptyProductDraft);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [editDraft, setEditDraft] = useState<ProductDraft>(emptyProductDraft);
  const [priceDraft, setPriceDraft] = useState({ preco_venda: "", preco_custo: "0", motivo: "" });
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
    mutationFn: async () => {
      const created = await api.produtos.create(productCreatePayload(draft));
      if (draft.imagem_file) {
        await api.produtos.uploadMedia(created.id, createProductMediaForm(draft.imagem_file));
      }
      return created;
    },
    onSuccess: () => {
      setDraft(emptyProductDraft);
      setCreating(false);
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
        vigente_desde: todayInputValue(),
        motivo: priceDraft.motivo || null
      }),
    onSuccess: () => {
      setPriceDraft({ preco_venda: "", preco_custo: "0", motivo: "" });
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
      url_imagem_principal: produto.url_imagem_principal || "",
      cor_botao: produto.cor_botao || "#ef4444",
      ordem_exibicao: String(produto.ordem_exibicao || 0),
      preco_venda: produto.preco_atual?.preco_venda || "",
      preco_custo: produto.preco_atual?.preco_custo || "0",
      motivo_preco: "",
      imagem_file: null,
      situacao: produto.situacao || "ativo"
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <NewProductCard onClick={() => setCreating(true)} />
        {productsQuery.isLoading ? <LoadingState label="Carregando produtos" /> : null}
        {productsQuery.error instanceof Error ? <ErrorState message={productsQuery.error.message} /> : null}
        {productsQuery.data?.length ? (
          productsQuery.data.map((produto) => <ProductRow key={produto.id} produto={produto} onEdit={openEdit} />)
        ) : !productsQuery.isLoading ? (
          <EmptyState title="Nenhum produto cadastrado" />
        ) : null}
      </div>

      <Modal title="Novo produto" open={creating} onClose={() => setCreating(false)}>
        <ProductForm
          value={draft}
          onChange={setDraft}
          onSubmit={() => createProduct.mutate()}
          submitting={createProduct.isPending}
          submitLabel="Criar produto"
          error={createProduct.error instanceof Error ? createProduct.error.message : null}
          includePrice
          includePhotoCapture
        />
      </Modal>

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

          <section className="grid gap-3 border-t border-bakery-border pt-4">
            <h3 className="text-xl font-black text-bakery-ink">Nova versao de preco</h3>
            <div className="grid gap-3 sm:grid-cols-2">
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

          <section className="grid gap-3 border-t border-bakery-border pt-4">
            <h3 className="text-xl font-black text-bakery-ink">Foto do produto</h3>
            <Input
              type="file"
              accept="image/*"
              capture="environment"
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

          <section className="grid gap-3 border-t border-bakery-border pt-4">
            <h3 className="text-xl font-black text-bakery-ink">Historico de precos</h3>
            {pricesQuery.isLoading ? <LoadingState label="Carregando precos" /> : null}
            {pricesQuery.data?.length ? (
              <div className="grid gap-2">
                {pricesQuery.data.map((price) => (
                  <div key={price.id} className="grid gap-1 rounded-bakeryLg bg-bakery-creamStrong/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-black text-bakery-ink">{formatCurrency(price.preco_venda)}</span>
                      <span className="text-sm font-bold text-bakery-muted">{formatDate(price.vigente_desde)}</span>
                    </div>
                    <p className="text-sm font-semibold text-bakery-muted">Custo {formatCurrency(price.preco_custo)}</p>
                  </div>
                ))}
              </div>
            ) : !pricesQuery.isLoading ? (
              <EmptyState title="Sem historico" />
            ) : null}
          </section>
        </div>
      </Modal>
    </div>
  );
}

function NewProductCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid min-h-48 place-items-center rounded-bakeryXl border-2 border-dashed border-bakery-border bg-white/60 p-5 text-center transition hover:border-bakery-ink focus:outline-none focus-visible:ring-4 focus-visible:ring-bakery-ink/10"
    >
      <span className="grid gap-3">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-bakery-brand text-white shadow-button">
          <Plus className="h-7 w-7" />
        </span>
        <span className="text-lg font-extrabold text-bakery-ink">Cadastrar produto</span>
        <span className="text-sm font-semibold text-bakery-muted">Adicionar um novo item ao cardápio</span>
      </span>
    </button>
  );
}

function ProductRow({ produto, onEdit }: { produto: Produto; onEdit: (produto: Produto) => void }) {
  const image = resolveMediaUrl(produto.url_imagem_principal);
  const buttonColor = produto.cor_botao || "#ef4444";

  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {image ? (
            <img src={image} alt="" className="h-24 w-24 shrink-0 rounded-bakeryLg object-cover" loading="lazy" />
          ) : (
            <div className="grid h-24 w-24 shrink-0 place-items-center rounded-bakeryLg bg-gradient-to-br from-bakery-creamStrong to-white text-bakery-brand shadow-inner">
              <Wheat className="h-9 w-9" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: buttonColor }} aria-hidden="true" />
              <h2 className="text-xl font-black text-bakery-ink">{produto.nome}</h2>
              <StatusBadge tone={produto.situacao === "ativo" ? "good" : "warn"}>{produto.situacao}</StatusBadge>
            </div>
            <p className="text-sm font-semibold text-bakery-muted">{produto.descricao || produto.descricao_visual || "Sem descricao"}</p>
            <p className="mt-1 text-xl font-extrabold tracking-tight tabular-nums text-bakery-ink">{formatCurrency(produto.preco_atual?.preco_venda)}</p>
          </div>
        </div>
        <Button type="button" variant="secondary" className="mt-auto w-full" onClick={() => onEdit(produto)} icon={<Edit3 className="h-4 w-4" />}>
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
  includeStatus,
  includePhotoCapture
}: {
  value: ProductDraft;
  onChange: (next: ProductDraft) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitLabel: string;
  error: string | null;
  includePrice?: boolean;
  includeStatus?: boolean;
  includePhotoCapture?: boolean;
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
      <Field label="Descricao">
        <Textarea value={value.descricao} onChange={(event) => onChange({ ...value, descricao: event.target.value })} />
      </Field>
      <Field label="Imagem URL">
        <Input
          value={value.url_imagem_principal}
          onChange={(event) => onChange({ ...value, url_imagem_principal: event.target.value })}
        />
      </Field>
      {includePhotoCapture ? (
        <Field label="Foto do produto" hint="Escolha uma imagem ou tire uma foto pelo celular.">
          <Input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => onChange({ ...value, imagem_file: event.target.files?.[0] || null })}
            className="py-3"
          />
        </Field>
      ) : null}
      {includePrice ? (
        <div className="grid gap-3 sm:grid-cols-2">
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
    url_imagem_principal: draft.url_imagem_principal,
    cor_botao: draft.cor_botao,
    ordem_exibicao: Number(draft.ordem_exibicao || 0),
    preco_venda: Number(draft.preco_venda || 0),
    preco_custo: Number(draft.preco_custo || 0),
    vigente_desde: todayInputValue(),
    motivo_preco: draft.motivo_preco || "Preco inicial"
  });
}

function productUpdatePayload(draft: ProductDraft) {
  return cleanPayload({
    nome: draft.nome,
    descricao: draft.descricao,
    url_imagem_principal: draft.url_imagem_principal,
    cor_botao: draft.cor_botao,
    ordem_exibicao: Number(draft.ordem_exibicao || 0),
    situacao: draft.situacao || "ativo"
  });
}
