import { AlertTriangle, ArrowRight, Plus } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Field, Input, ProductPhoto, StateText, Stepper } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, toNumber } from "@/lib/format";
import { colors, fonts, radius } from "@/lib/theme";
import { fixProductName } from "@/utils/text";
import type { CorrecaoItemVendaRequest, CorrecaoProducaoRequest, Produto, ResumoDoDia } from "@/types/api";

type Step = "warning" | "edit" | "confirm";

interface ItemState {
  produced: number;
  sold: number;
}

// Correção controlada de um dia já fechado: aviso claro → edição com
// botões de mais/menos → resumo do que muda → salvar.
export function EditDayFlow({ resumo, onCancel, onSaved }: { resumo: ResumoDoDia; onCancel: () => void; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("warning");
  const [reason, setReason] = useState("");
  const [showAddList, setShowAddList] = useState(false);
  const [extraProductIds, setExtraProductIds] = useState<string[]>([]);

  const original = useMemo(() => {
    const map: Record<string, ItemState> = {};
    resumo.produtos?.forEach((produto) => {
      map[produto.produto_id] = {
        produced: produto.quantidade_produzida ?? 0,
        sold: produto.quantidade_vendida ?? 0
      };
    });
    return map;
  }, [resumo]);

  const [edits, setEdits] = useState<Record<string, ItemState>>(() => ({ ...original }));

  const productsQuery = useQuery({ queryKey: ["produtos", "ativos"], queryFn: () => api.produtos.list(true) });
  const allProducts = useMemo(() => productsQuery.data || [], [productsQuery.data]);

  // Vendas do dia: necessárias para corrigir itens de venda existentes.
  const salesQuery = useQuery({
    queryKey: ["vendas", "dia", resumo.dia_de_venda_id],
    queryFn: () => api.vendas.listByDay(resumo.dia_de_venda_id)
  });

  // Preço unitário para estimar o faturamento: primeiro o praticado no dia,
  // depois o preço atual do catálogo.
  const unitPrice = useMemo(() => {
    const map: Record<string, number> = {};
    resumo.produtos?.forEach((produto) => {
      const sold = produto.quantidade_vendida ?? 0;
      const revenue = toNumber(produto.faturamento_bruto);
      if (sold > 0 && revenue > 0) map[produto.produto_id] = revenue / sold;
    });
    allProducts.forEach((produto) => {
      if (!map[produto.id]) map[produto.id] = toNumber(produto.preco_atual?.preco_venda);
    });
    return map;
  }, [resumo, allProducts]);

  const rows = useMemo(() => {
    const base = (resumo.produtos || []).map((produto) => ({
      id: produto.produto_id,
      name: produto.nome_produto,
      photo: produto.url_imagem_produto
    }));
    const extras = extraProductIds
      .filter((id) => !base.some((row) => row.id === id))
      .map((id) => {
        const produto = allProducts.find((candidate) => candidate.id === id);
        return { id, name: produto?.nome || "Produto", photo: produto?.url_imagem_principal };
      });
    return [...base, ...extras];
  }, [resumo, extraProductIds, allProducts]);

  const availableToAdd = useMemo(
    () => allProducts.filter((produto) => !rows.some((row) => row.id === produto.id)),
    [allProducts, rows]
  );

  const changes = useMemo(() => {
    return rows
      .map((row) => {
        const before = original[row.id] || { produced: 0, sold: 0 };
        const after = edits[row.id] || { produced: 0, sold: 0 };
        return { row, before, after };
      })
      .filter(({ before, after }) => before.produced !== after.produced || before.sold !== after.sold);
  }, [rows, original, edits]);

  const currentRevenue = toNumber(resumo.faturamento_bruto);
  const newRevenue = useMemo(() => {
    return changes.reduce((sum, { row, before, after }) => {
      const price = unitPrice[row.id] || 0;
      return sum + (after.sold - before.sold) * price;
    }, currentRevenue);
  }, [changes, unitPrice, currentRevenue]);

  const save = useMutation({
    mutationFn: async () => {
      const sales = salesQuery.data ?? (await api.vendas.listByDay(resumo.dia_de_venda_id));

      // Traduz o "antes → depois" da edição para o contrato de correções:
      // produção corrigida, itens de venda reduzidos e venda retroativa
      // para as quantidades que faltou lançar.
      const producoes: CorrecaoProducaoRequest[] = [];
      const itensVenda: CorrecaoItemVendaRequest[] = [];
      const itensAdicionados: { produto_id: string; quantidade: number }[] = [];

      for (const { row, before, after } of changes) {
        if (before.produced !== after.produced) {
          producoes.push({ produto_id: row.id, quantidade_produzida: after.produced });
        }

        const delta = after.sold - before.sold;
        if (delta > 0) {
          itensAdicionados.push({ produto_id: row.id, quantidade: delta });
        } else if (delta < 0) {
          // Reduz a partir das vendas mais recentes, preservando as antigas.
          let toRemove = -delta;
          const items = sales
            .filter((sale) => sale.situacao !== "cancelada")
            .flatMap((sale) => sale.itens || [])
            .filter((item) => item.produto_id === row.id)
            .sort((a, b) => (a.criado_em < b.criado_em ? 1 : -1));

          for (const item of items) {
            if (toRemove <= 0) break;
            const reduceBy = Math.min(item.quantidade, toRemove);
            itensVenda.push({ item_venda_id: item.id, quantidade: item.quantidade - reduceBy });
            toRemove -= reduceBy;
          }

          if (toRemove > 0) {
            throw new Error(`Não encontrei vendas suficientes de ${fixProductName(row.name)} para reduzir.`);
          }
        }
      }

      return api.dias.corrections(resumo.dia_de_venda_id, {
        usuario_id: user?.id || "app",
        motivo: reason.trim() || null,
        ...(producoes.length ? { producoes } : {}),
        ...(itensVenda.length ? { itens_venda: itensVenda } : {}),
        ...(itensAdicionados.length ? { vendas_adicionadas: [{ itens: itensAdicionados }] } : {})
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
      queryClient.invalidateQueries({ queryKey: ["dias"] });
      queryClient.invalidateQueries({ queryKey: ["historico"] });
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      onSaved();
    }
  });

  function setItem(produtoId: string, patch: Partial<ItemState>) {
    setEdits((current) => {
      const item = current[produtoId] || { produced: 0, sold: 0 };
      return { ...current, [produtoId]: { ...item, ...patch } };
    });
  }

  if (step === "warning") {
    return (
      <View style={styles.warningBox}>
        <View style={styles.warningHeader}>
          <AlertTriangle size={22} color={colors.warning} />
          <Text style={styles.warningTitle}>Você está editando um dia já fechado</Text>
        </View>
        <Text style={styles.warningText}>
          As alterações podem mudar o faturamento, o histórico, os gráficos e as análises. Deseja continuar?
        </Text>
        <Button title="Continuar edição" onPress={() => setStep("edit")} />
        <Button title="Cancelar" tone="soft" onPress={onCancel} />
      </View>
    );
  }

  if (step === "confirm") {
    return (
      <>
        <Badge text="Correção retroativa" tone="warn" />
        <Text style={styles.confirmTitle}>Resumo das alterações</Text>

        {changes.map(({ row, before, after }) => {
          const price = unitPrice[row.id] || 0;
          return (
            <View key={row.id} style={styles.changeCard}>
              <Text style={styles.changeName}>{fixProductName(row.name)}</Text>
              {before.produced !== after.produced ? (
                <ChangeLine label="Produzido" from={String(before.produced)} to={String(after.produced)} />
              ) : null}
              {before.sold !== after.sold ? (
                <>
                  <ChangeLine label="Vendido" from={String(before.sold)} to={String(after.sold)} />
                  {price > 0 ? (
                    <ChangeLine
                      label="Faturamento"
                      from={formatCurrency(before.sold * price)}
                      to={formatCurrency(after.sold * price)}
                    />
                  ) : null}
                </>
              ) : null}
            </View>
          );
        })}

        <View style={styles.newTotalBox}>
          <Text style={styles.newTotalLabel}>Novo faturamento do dia (estimado)</Text>
          <Text style={styles.newTotalValue}>{formatCurrency(newRevenue)}</Text>
        </View>

        <Field label="Motivo da correção (opcional)">
          <Input value={reason} onChangeText={setReason} placeholder="Ex: venda que faltou lançar" />
        </Field>

        {save.error ? <StateText tone="error" text={correctionErrorMessage(save.error)} /> : null}
        <Button
          title={save.isPending ? "Salvando..." : "Salvar correções"}
          tone="success"
          disabled={save.isPending}
          onPress={() => save.mutate()}
        />
        <Button title="Voltar" tone="soft" onPress={() => setStep("edit")} />
      </>
    );
  }

  return (
    <>
      <Badge text="Editando dia fechado" tone="warn" />
      <Text style={styles.editHint}>
        Ajuste o que foi produzido e vendido em cada produto. Nada muda até você confirmar no final.
      </Text>

      {rows.map((row) => {
        const item = edits[row.id] || { produced: 0, sold: 0 };
        return (
          <View key={row.id} style={styles.editRow}>
            <View style={styles.editRowHeader}>
              <ProductPhoto url={row.photo} name={row.name} size={44} />
              <Text style={styles.editRowName}>{fixProductName(row.name)}</Text>
            </View>
            <View style={styles.editControls}>
              <View style={styles.editControl}>
                <Text style={styles.editControlLabel}>Produzido</Text>
                <Stepper
                  size="sm"
                  value={item.produced}
                  onIncrement={() => setItem(row.id, { produced: item.produced + 1 })}
                  onDecrement={() => setItem(row.id, { produced: Math.max(0, item.produced - 1) })}
                />
              </View>
              <View style={styles.editControl}>
                <Text style={styles.editControlLabel}>Vendido</Text>
                <Stepper
                  size="sm"
                  value={item.sold}
                  onIncrement={() => setItem(row.id, { sold: item.sold + 1 })}
                  onDecrement={() => setItem(row.id, { sold: Math.max(0, item.sold - 1) })}
                />
              </View>
            </View>
            <Text style={styles.editLeftover}>Sobra: {Math.max(0, item.produced - item.sold)}</Text>
          </View>
        );
      })}

      {availableToAdd.length ? (
        <Pressable onPress={() => setShowAddList((current) => !current)} style={({ pressed }) => [styles.addToggle, pressed && styles.pressed]}>
          <Plus size={18} color={colors.brandDeep} />
          <Text style={styles.addToggleText}>Adicionar produto que faltou no dia</Text>
        </Pressable>
      ) : null}
      {showAddList
        ? availableToAdd.map((produto: Produto) => (
            <Pressable
              key={produto.id}
              onPress={() => {
                setExtraProductIds((current) => [...current, produto.id]);
                setShowAddList(false);
              }}
              style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}
            >
              <ProductPhoto url={produto.url_imagem_principal} name={produto.nome} size={40} />
              <Text style={styles.addRowName}>{fixProductName(produto.nome)}</Text>
              <Plus size={18} color={colors.brandDeep} />
            </Pressable>
          ))
        : null}

      <Button
        title="Revisar alterações"
        disabled={!changes.length}
        onPress={() => setStep("confirm")}
      />
      {!changes.length ? <StateText text="Nenhuma alteração feita até agora." /> : null}
      <Button title="Cancelar" tone="soft" onPress={onCancel} />
    </>
  );
}

function ChangeLine({ label, from, to }: { label: string; from: string; to: string }) {
  return (
    <View style={styles.changeLine}>
      <Text style={styles.changeLabel}>{label}</Text>
      <Text style={styles.changeFrom}>{from}</Text>
      <ArrowRight size={14} color={colors.muted} />
      <Text style={styles.changeTo}>{to}</Text>
    </View>
  );
}

function correctionErrorMessage(error: unknown) {
  if (error instanceof ApiError && [404, 405, 501].includes(error.status)) {
    return "O servidor não aceitou a correção. Confira se o app está apontando para o servidor certo no Perfil.";
  }
  return error instanceof Error ? error.message : "Não foi possível salvar as correções.";
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.8
  },
  warningBox: {
    gap: 12,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.warningSoft,
    backgroundColor: colors.surfaceGlow,
    padding: 16
  },
  warningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  warningTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 17,
    fontFamily: fonts.display
  },
  warningText: {
    color: colors.muted,
    fontSize: 15,
    fontFamily: fonts.body,
    lineHeight: 21
  },
  editHint: {
    color: colors.muted,
    fontSize: 14,
    fontFamily: fonts.body
  },
  editRow: {
    gap: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12
  },
  editRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  editRowName: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  editControls: {
    flexDirection: "row",
    gap: 10
  },
  editControl: {
    flex: 1,
    gap: 4,
    alignItems: "center"
  },
  editControlLabel: {
    color: colors.muted,
    fontSize: 12,
    fontFamily: fonts.bodyBold
  },
  editLeftover: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    textAlign: "center"
  },
  addToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.brandSoft,
    backgroundColor: colors.surfaceGlow
  },
  addToggleText: {
    color: colors.brandDeep,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 10
  },
  addRowName: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  confirmTitle: {
    color: colors.ink,
    fontSize: 20,
    fontFamily: fonts.display
  },
  changeCard: {
    gap: 6,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12
  },
  changeName: {
    color: colors.ink,
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  changeLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  changeLabel: {
    minWidth: 92,
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.bodyBold
  },
  changeFrom: {
    color: colors.muted,
    fontSize: 14,
    fontFamily: fonts.body,
    textDecorationLine: "line-through"
  },
  changeTo: {
    color: colors.ink,
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  newTotalBox: {
    gap: 2,
    borderRadius: radius.lg,
    backgroundColor: colors.successSoft,
    padding: 14
  },
  newTotalLabel: {
    color: colors.success,
    fontSize: 13,
    fontFamily: fonts.bodyBold
  },
  newTotalValue: {
    color: colors.success,
    fontSize: 26,
    fontFamily: fonts.display,
    letterSpacing: -0.5
  }
});
