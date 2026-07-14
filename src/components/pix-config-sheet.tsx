import { QrCode } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Field, Input, Sheet, StateText } from "@/components/ui";
import {
  emptyPixConfig,
  maskPixKeyInput,
  PIX_KEY_LABEL,
  savePixConfig,
  type PixConfig,
  type PixKeyType
} from "@/lib/pix-config";
import { colors, fonts, radius } from "@/lib/theme";

const TIPOS: { key: PixKeyType; label: string; placeholder: string; keyboard: "default" | "phone-pad" | "number-pad" | "email-address" }[] = [
  { key: "telefone", label: "Celular", placeholder: "(11) 98765-4321", keyboard: "phone-pad" },
  { key: "email", label: "E-mail", placeholder: "voce@email.com", keyboard: "email-address" },
  { key: "cpf", label: "CPF", placeholder: "Só números", keyboard: "number-pad" },
  { key: "cnpj", label: "CNPJ", placeholder: "Só números", keyboard: "number-pad" },
  { key: "aleatoria", label: "Aleatória", placeholder: "Chave aleatória do banco", keyboard: "default" }
];

// Cadastro da chave Pix da própria pessoa. Simples e direto: escolha o tipo,
// digite a chave, o nome que aparece no banco e (opcional) a cidade. Só com
// chave + nome preenchidos o QR pode ser gerado na Venda.
export function PixConfigSheet({
  visible,
  onClose,
  userId,
  initial,
  onSaved
}: {
  visible: boolean;
  onClose: () => void;
  userId?: string | null;
  initial?: PixConfig | null;
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<PixConfig>(initial || emptyPixConfig);
  const [validation, setValidation] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Entre na sua conta para salvar sua chave Pix.");
      const limpo: PixConfig = {
        tipoChave: draft.tipoChave,
        chave: draft.chave.trim(),
        nome: draft.nome.trim(),
        cidade: draft.cidade.trim()
      };
      await savePixConfig(userId, limpo);
      return limpo;
    },
    onSuccess: (limpo) => {
      // Atualiza o cache na hora (sem flash de "não configurado" ao reabrir o Pix).
      if (userId) queryClient.setQueryData(["pix-config", userId], limpo);
      queryClient.invalidateQueries({ queryKey: ["pix-config"] });
      onSaved?.();
      onClose();
    }
  });
  const resetSave = save.reset;

  // Cada abertura parte do que está salvo, sem sobras da edição anterior.
  useEffect(() => {
    if (visible) {
      setDraft(initial || emptyPixConfig);
      setValidation(null);
      resetSave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function submit() {
    if (!draft.chave.trim()) {
      setValidation("Informe sua chave Pix.");
      return;
    }
    if (!draft.nome.trim()) {
      setValidation("Informe o nome que recebe o Pix.");
      return;
    }
    setValidation(null);
    save.mutate();
  }

  const tipoAtual = TIPOS.find((tipo) => tipo.key === draft.tipoChave) || TIPOS[0];

  return (
    <Sheet
      visible={visible}
      title="Seu Pix"
      subtitle="Cadastre sua chave para gerar o QR Code na Venda."
      onClose={onClose}
      headerAccent={
        <View style={styles.headerBadge}>
          <QrCode size={22} color={colors.brandDeep} strokeWidth={2.4} />
        </View>
      }
    >
      <Field label="Tipo da chave">
        <View style={styles.tipoRow}>
          {TIPOS.map((tipo) => {
            const ativo = draft.tipoChave === tipo.key;
            return (
              <Pressable
                key={tipo.key}
                onPress={() => setDraft((atual) => ({ ...atual, tipoChave: tipo.key, chave: maskPixKeyInput(tipo.key, atual.chave) }))}
                style={[styles.tipoChip, ativo && styles.tipoChipActive]}
              >
                <Text style={[styles.tipoChipText, ativo && styles.tipoChipTextActive]}>{PIX_KEY_LABEL[tipo.key]}</Text>
              </Pressable>
            );
          })}
        </View>
      </Field>

      <Field label={`Chave Pix (${tipoAtual.label.toLowerCase()})`}>
        <Input
          value={draft.chave}
          onChangeText={(chave) => setDraft((atual) => ({ ...atual, chave: maskPixKeyInput(atual.tipoChave, chave) }))}
          placeholder={tipoAtual.placeholder}
          keyboardType={tipoAtual.keyboard}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </Field>

      <Field label="Nome que recebe o Pix">
        <Input
          value={draft.nome}
          onChangeText={(nome) => setDraft((atual) => ({ ...atual, nome }))}
          placeholder="Ex: Maria da Padoca"
          maxLength={25}
        />
      </Field>

      <Field label="Cidade (opcional)">
        <Input
          value={draft.cidade}
          onChangeText={(cidade) => setDraft((atual) => ({ ...atual, cidade }))}
          placeholder="Ex: São Paulo"
          maxLength={15}
        />
      </Field>

      <Text style={styles.hint}>
        A chave e o nome aparecem para o cliente no app do banco. Confira com cuidado para o dinheiro cair na conta certa.
      </Text>

      {validation ? <StateText tone="error" text={validation} /> : null}
      {save.error ? <StateText tone="error" text={save.error instanceof Error ? save.error.message : "Não foi possível salvar."} /> : null}

      <Button title={save.isPending ? "Salvando..." : "Salvar meu Pix"} disabled={save.isPending} onPress={submit} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  headerBadge: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft
  },
  tipoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  tipoChip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden"
  },
  tipoChipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft
  },
  tipoChipText: {
    color: colors.muted,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  tipoChipTextActive: {
    color: colors.brandDeep
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.body
  }
});
