import { LinearGradient } from "expo-linear-gradient";
import { BadgeCheck, Send, Trash2 } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AgentTag } from "@/components/agent";
import { Button, Field, Input, Money, Sheet, StateText } from "@/components/ui";
import { custoPorUnidade, parseDecimalInput, recipeUsageText } from "@/lib/custeio";
import { formatCurrency } from "@/lib/format";
import { colors, fonts, gradients, radius, shadows } from "@/lib/theme";
import type { CustoAdicionalRascunho, CustoSimulado, IngredienteRascunho, ReceitaRascunho } from "@/types/custeio";

// ---------------------------------------------------------------------------
// Chips de escolha única (unidades, aplicação): mais fáceis que digitar.
// ---------------------------------------------------------------------------

function ChoiceChips({
  options,
  value,
  onChange
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  // Valor fora da lista (veio da IA) vira um chip extra para não sumir.
  const allOptions = options.some((option) => option.value === value) || !value
    ? options
    : [...options, { value, label: value }];

  return (
    <View style={styles.chipsRow}>
      {allOptions.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const UNIT_OPTIONS = [
  { value: "g", label: "g" },
  { value: "kg", label: "kg" },
  { value: "ml", label: "ml" },
  { value: "l", label: "L" },
  { value: "unidade", label: "unid." }
];

// ---------------------------------------------------------------------------
// Escrever para o assistente (também usado para responder perguntas).
// ---------------------------------------------------------------------------

export function TextComposerSheet({
  visible,
  pergunta,
  onClose,
  onSend,
  pending,
  errorText
}: {
  visible: boolean;
  pergunta: string | null;
  onClose: () => void;
  onSend: (texto: string, contexto?: string | null) => void;
  pending: boolean;
  errorText: string | null;
}) {
  return (
    <Sheet
      visible={visible}
      title={pergunta ? "Responder" : "Escrever para o assistente"}
      subtitle={pergunta ? undefined : "Conte do seu jeito: ingredientes, preços e rendimento"}
      onClose={onClose}
    >
      {visible ? (
        <TextComposerForm pergunta={pergunta} onSend={onSend} pending={pending} errorText={errorText} />
      ) : null}
    </Sheet>
  );
}

function TextComposerForm({
  pergunta,
  onSend,
  pending,
  errorText
}: {
  pergunta: string | null;
  onSend: (texto: string, contexto?: string | null) => void;
  pending: boolean;
  errorText: string | null;
}) {
  const [text, setText] = useState("");

  return (
    <>
      {pergunta ? (
        <View style={styles.questionEcho}>
          <AgentTag />
          <Text style={styles.questionEchoText}>{pergunta}</Text>
        </View>
      ) : null}
      <Input
        value={text}
        onChangeText={setText}
        multiline
        placeholder={
          pergunta
            ? "Ex: rendeu 12 unidades"
            : "Ex: usei 800g de farinha, o pacote de 5kg custou 22 reais e rendeu 12 pães"
        }
        style={styles.composerInput}
        autoFocus
      />
      {errorText ? <StateText tone="error" text={errorText} /> : null}
      <Button
        title={pending ? "Enviando..." : "Enviar"}
        tone="agent"
        icon={<Send size={18} color="#fff" />}
        disabled={!text.trim() || pending}
        onPress={() => onSend(text.trim(), pergunta)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Edição da receita (nome + rendimento).
// ---------------------------------------------------------------------------

export function ReceitaSheet({
  visible,
  receita,
  onClose,
  onSave,
  pending,
  errorText
}: {
  visible: boolean;
  receita: ReceitaRascunho | null;
  onClose: () => void;
  onSave: (receita: ReceitaRascunho) => void;
  pending: boolean;
  errorText: string | null;
}) {
  return (
    <Sheet visible={visible} title="Receita" subtitle="Nome e quanto ela rende" onClose={onClose}>
      {visible ? <ReceitaForm receita={receita} onSave={onSave} pending={pending} errorText={errorText} /> : null}
    </Sheet>
  );
}

function ReceitaForm({
  receita,
  onSave,
  pending,
  errorText
}: {
  receita: ReceitaRascunho | null;
  onSave: (receita: ReceitaRascunho) => void;
  pending: boolean;
  errorText: string | null;
}) {
  const [nome, setNome] = useState(receita?.nome || "");
  const [rendimento, setRendimento] = useState(receita?.rendimento ? String(receita.rendimento) : "");
  const [unidade, setUnidade] = useState(receita?.unidade_rendimento || "unidade");
  const rendimentoValue = parseDecimalInput(rendimento);

  return (
    <>
      <Field label="Nome da receita">
        <Input value={nome} onChangeText={setNome} placeholder="Ex: Receita base" />
      </Field>
      <Field label="Quantas unidades rende?">
        <Input value={rendimento} onChangeText={setRendimento} keyboardType="decimal-pad" placeholder="Ex: 12" />
      </Field>
      <Field label="Rende em">
        <ChoiceChips
          options={[
            { value: "unidade", label: "Unidades" },
            { value: "fatia", label: "Fatias" },
            { value: "porcao", label: "Porções" }
          ]}
          value={unidade}
          onChange={setUnidade}
        />
      </Field>
      {errorText ? <StateText tone="error" text={errorText} /> : null}
      <Button
        title={pending ? "Salvando..." : "Salvar receita"}
        disabled={pending || rendimentoValue === null || rendimentoValue <= 0}
        onPress={() =>
          onSave({
            ...receita,
            nome: nome.trim() || "Receita base",
            rendimento: rendimentoValue,
            unidade_rendimento: unidade,
            status: "CONFIRMADO"
          })
        }
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Edição/adição de ingrediente.
// ---------------------------------------------------------------------------

export function IngredienteSheet({
  visible,
  mode,
  ingrediente,
  onClose,
  onSave,
  onRemove,
  pending,
  errorText
}: {
  visible: boolean;
  mode: "receita" | "preco";
  ingrediente: IngredienteRascunho | null;
  onClose: () => void;
  onSave: (ingrediente: IngredienteRascunho) => void;
  onRemove: (() => void) | null;
  pending: boolean;
  errorText: string | null;
}) {
  const title = ingrediente?.nome || "Novo ingrediente";
  const subtitle = mode === "receita" ? "Quanto você usa na receita" : "Quanto comprou e quanto pagou";
  return (
    <Sheet visible={visible} title={title} subtitle={subtitle} onClose={onClose}>
      {visible ? (
        <IngredienteForm mode={mode} ingrediente={ingrediente} onSave={onSave} onRemove={onRemove} pending={pending} errorText={errorText} />
      ) : null}
    </Sheet>
  );
}

function IngredienteForm({
  mode,
  ingrediente,
  onSave,
  onRemove,
  pending,
  errorText
}: {
  mode: "receita" | "preco";
  ingrediente: IngredienteRascunho | null;
  onSave: (ingrediente: IngredienteRascunho) => void;
  onRemove: (() => void) | null;
  pending: boolean;
  errorText: string | null;
}) {
  const [nome, setNome] = useState(ingrediente?.nome || "");
  const [quantidadeUsada, setQuantidadeUsada] = useState(
    ingrediente?.quantidade_usada !== null && ingrediente?.quantidade_usada !== undefined ? String(ingrediente.quantidade_usada) : ""
  );
  const [unidadeUsada, setUnidadeUsada] = useState(ingrediente?.unidade_usada || "g");
  const [quantidadeComprada, setQuantidadeComprada] = useState(
    ingrediente?.quantidade_comprada !== null && ingrediente?.quantidade_comprada !== undefined
      ? String(ingrediente.quantidade_comprada)
      : ""
  );
  const [unidadeCompra, setUnidadeCompra] = useState(ingrediente?.unidade_compra || "kg");
  const [precoTotal, setPrecoTotal] = useState(
    ingrediente?.preco_total !== null && ingrediente?.preco_total !== undefined ? String(ingrediente.preco_total) : ""
  );

  // Etapa RECEITA: só nome + quanto usa. Nada de preço, para não misturar.
  if (mode === "receita") {
    const usada = parseDecimalInput(quantidadeUsada);
    const canSave = Boolean(nome.trim()) && usada !== null && usada > 0;
    return (
      <>
        <Field label="Ingrediente">
          <Input value={nome} onChangeText={setNome} placeholder="Ex: Farinha de trigo" />
        </Field>
        <Field label="Quantidade usada na receita">
          <Input value={quantidadeUsada} onChangeText={setQuantidadeUsada} keyboardType="decimal-pad" placeholder="Ex: 800" />
        </Field>
        <ChoiceChips options={UNIT_OPTIONS} value={unidadeUsada} onChange={setUnidadeUsada} />
        {errorText ? <StateText tone="error" text={errorText} /> : null}
        <Button
          title={pending ? "Salvando..." : "Salvar ingrediente"}
          disabled={pending || !canSave}
          onPress={() =>
            onSave({
              ...ingrediente,
              nome: nome.trim(),
              quantidade_usada: usada,
              unidade_usada: unidadeUsada,
              status: "CONFIRMADO"
            })
          }
        />
        {onRemove ? (
          <Pressable onPress={pending ? undefined : onRemove} style={({ pressed }) => [styles.removeLink, pressed && styles.pressed]}>
            <Trash2 size={16} color={colors.danger} />
            <Text style={styles.removeLinkText}>Tirar da receita</Text>
          </Pressable>
        ) : null}
      </>
    );
  }

  // Etapa PREÇOS: mostra o uso na receita como contexto e pede só a compra.
  const usadaContexto = recipeUsageText(ingrediente || {});
  const comprada = parseDecimalInput(quantidadeComprada);
  const preco = parseDecimalInput(precoTotal);
  const canSave = comprada !== null && comprada > 0 && preco !== null && preco > 0;
  return (
    <>
      {usadaContexto ? (
        <View style={styles.contextRow}>
          <Text style={styles.contextText}>Na receita: {usadaContexto}</Text>
        </View>
      ) : null}
      <Field label="Quanto veio no pacote/compra?">
        <Input value={quantidadeComprada} onChangeText={setQuantidadeComprada} keyboardType="decimal-pad" placeholder="Ex: 5" />
      </Field>
      <ChoiceChips options={UNIT_OPTIONS} value={unidadeCompra} onChange={setUnidadeCompra} />
      <Field label="Quanto pagou no total? (R$)">
        <Input value={precoTotal} onChangeText={setPrecoTotal} keyboardType="decimal-pad" placeholder="Ex: 22,00" />
      </Field>
      {errorText ? <StateText tone="error" text={errorText} /> : null}
      <Button
        title={pending ? "Salvando..." : "Salvar preço"}
        disabled={pending || !canSave}
        onPress={() =>
          onSave({
            ...ingrediente,
            quantidade_comprada: comprada,
            unidade_compra: unidadeCompra,
            preco_total: preco,
            status: "CONFIRMADO"
          })
        }
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Edição/adição de custos extras (embalagem, gás, entrega...).
// ---------------------------------------------------------------------------

const EXTRA_TYPE_OPTIONS = [
  { value: "embalagem", label: "📦 Embalagem" },
  { value: "gas", label: "🔥 Gás" },
  { value: "energia", label: "⚡ Energia" },
  { value: "transporte", label: "🚗 Transporte" },
  { value: "outro", label: "🧾 Outro" }
];

export function ExtraCostSheet({
  visible,
  custo,
  onClose,
  onSave,
  onRemove,
  pending,
  errorText
}: {
  visible: boolean;
  custo: CustoAdicionalRascunho | null;
  onClose: () => void;
  onSave: (custo: CustoAdicionalRascunho) => void;
  onRemove: (() => void) | null;
  pending: boolean;
  errorText: string | null;
}) {
  return (
    <Sheet
      visible={visible}
      title={custo?.nome || "Outro custo"}
      subtitle="Embalagem, gás, energia, entrega..."
      onClose={onClose}
    >
      {visible ? <ExtraCostForm custo={custo} onSave={onSave} onRemove={onRemove} pending={pending} errorText={errorText} /> : null}
    </Sheet>
  );
}

function ExtraCostForm({
  custo,
  onSave,
  onRemove,
  pending,
  errorText
}: {
  custo: CustoAdicionalRascunho | null;
  onSave: (custo: CustoAdicionalRascunho) => void;
  onRemove: (() => void) | null;
  pending: boolean;
  errorText: string | null;
}) {
  const [tipo, setTipo] = useState(custo?.tipo || "embalagem");
  const [nome, setNome] = useState(custo?.nome || "");
  const [valor, setValor] = useState(custo?.valor !== null && custo?.valor !== undefined ? String(custo.valor) : "");
  const [aplicacao, setAplicacao] = useState(custo?.aplicacao || "por_unidade");
  const valorNumber = parseDecimalInput(valor);

  return (
    <>
      <Field label="Tipo">
        <ChoiceChips options={EXTRA_TYPE_OPTIONS} value={tipo} onChange={setTipo} />
      </Field>
      <Field label="Nome">
        <Input value={nome} onChangeText={setNome} placeholder="Ex: Saquinho" />
      </Field>
      <Field label="Valor (R$)">
        <Input value={valor} onChangeText={setValor} keyboardType="decimal-pad" placeholder="Ex: 0,35" />
      </Field>
      <Field label="Esse valor é...">
        <ChoiceChips
          options={[
            { value: "por_unidade", label: "Por unidade" },
            { value: "por_receita", label: "Pela receita toda" }
          ]}
          value={aplicacao}
          onChange={setAplicacao}
        />
      </Field>
      {errorText ? <StateText tone="error" text={errorText} /> : null}
      <Button
        title={pending ? "Salvando..." : "Salvar custo"}
        disabled={pending || !nome.trim() || valorNumber === null || valorNumber <= 0}
        onPress={() =>
          onSave({
            ...custo,
            tipo,
            nome: nome.trim(),
            valor: valorNumber,
            aplicacao,
            status: "CONFIRMADO"
          })
        }
      />
      {onRemove ? (
        <Pressable onPress={pending ? undefined : onRemove} style={({ pressed }) => [styles.removeLink, pressed && styles.pressed]}>
          <Trash2 size={16} color={colors.danger} />
          <Text style={styles.removeLinkText}>Remover este custo</Text>
        </Pressable>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Confirmação final: resumo + escolha de atualizar o custo do produto.
// ---------------------------------------------------------------------------

export function ConfirmSheet({
  visible,
  custo,
  precoVenda,
  onClose,
  onConfirm,
  pending,
  errorText
}: {
  visible: boolean;
  custo: CustoSimulado | null;
  precoVenda: number | null;
  onClose: () => void;
  onConfirm: (atualizarPreco: boolean) => void;
  pending: boolean;
  errorText: string | null;
}) {
  return (
    <Sheet visible={visible} title="Confirmar custo" subtitle="Última conferida antes de salvar" onClose={onClose}>
      {visible ? (
        <ConfirmForm custo={custo} precoVenda={precoVenda} onConfirm={onConfirm} pending={pending} errorText={errorText} />
      ) : null}
    </Sheet>
  );
}

function ConfirmForm({
  custo,
  precoVenda,
  onConfirm,
  pending,
  errorText
}: {
  custo: CustoSimulado | null;
  precoVenda: number | null;
  onConfirm: (atualizarPreco: boolean) => void;
  pending: boolean;
  errorText: string | null;
}) {
  const [atualizarPreco, setAtualizarPreco] = useState(true);
  const unidade = custoPorUnidade(custo);
  const lucro = precoVenda !== null && unidade !== null ? precoVenda - unidade : null;

  return (
    <>
      <LinearGradient colors={gradients.agent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.confirmHero, shadows.agent]}>
        <Text style={styles.confirmHeroLabel}>Custo por unidade</Text>
        <Money value={unidade ?? 0} size={40} color="#fff" prefixColor="rgba(255,255,255,0.8)" />
        {lucro !== null && precoVenda !== null ? (
          <Text style={styles.confirmHeroHint}>
            Vendendo a {formatCurrency(precoVenda)}, sobra {formatCurrency(lucro)} por unidade.
          </Text>
        ) : null}
      </LinearGradient>

      <ToggleRow
        active={atualizarPreco}
        onToggle={() => setAtualizarPreco((value) => !value)}
        title="Atualizar o custo do produto"
        subtitle={
          atualizarPreco
            ? `O custo cadastrado passa a ser ${unidade !== null ? formatCurrency(unidade) : "o calculado"} a partir de hoje.`
            : "O cálculo fica guardado, mas o custo cadastrado não muda."
        }
      />

      {errorText ? <StateText tone="error" text={errorText} /> : null}
      <Button
        title={pending ? "Confirmando..." : "Confirmar custo"}
        tone="success"
        icon={<BadgeCheck size={18} color="#fff" />}
        disabled={pending}
        onPress={() => onConfirm(atualizarPreco)}
      />
    </>
  );
}

function ToggleRow({
  active,
  onToggle,
  title,
  subtitle
}: {
  active: boolean;
  onToggle: () => void;
  title: string;
  subtitle: ReactNode;
}) {
  return (
    <Pressable onPress={onToggle} style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}>
      <View style={[styles.toggleTrack, active && styles.toggleTrackActive]}>
        <View style={[styles.toggleThumb, active && styles.toggleThumbActive]} />
      </View>
      <View style={styles.toggleBody}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleSubtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 15,
    paddingVertical: 9
  },
  chipActive: {
    borderColor: colors.agentDeep,
    backgroundColor: colors.agentSoft
  },
  chipText: {
    color: colors.muted,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  chipTextActive: {
    color: colors.agentDeep
  },
  questionEcho: {
    gap: 8,
    borderRadius: radius.lg,
    backgroundColor: colors.agentSoft,
    padding: 13
  },
  questionEchoText: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.bodyBold
  },
  composerInput: {
    minHeight: 110,
    paddingTop: 14,
    textAlignVertical: "top"
  },
  contextRow: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceWarm,
    paddingHorizontal: 13,
    paddingVertical: 11
  },
  contextText: {
    color: colors.ink,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  removeLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "center",
    minHeight: 40,
    paddingHorizontal: 16
  },
  removeLinkText: {
    color: colors.danger,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  confirmHero: {
    gap: 4,
    borderRadius: radius.xl,
    padding: 18
  },
  confirmHeroLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  confirmHeroHint: {
    color: "#fff",
    fontSize: 14.5,
    lineHeight: 21,
    fontFamily: fonts.body
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14
  },
  toggleTrack: {
    height: 30,
    width: 52,
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    paddingHorizontal: 3
  },
  toggleTrackActive: {
    backgroundColor: colors.success
  },
  toggleThumb: {
    height: 24,
    width: 24,
    borderRadius: radius.pill,
    backgroundColor: "#fff"
  },
  toggleThumbActive: {
    alignSelf: "flex-end"
  },
  toggleBody: {
    flex: 1,
    gap: 2
  },
  toggleTitle: {
    color: colors.ink,
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  toggleSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.body
  }
});
