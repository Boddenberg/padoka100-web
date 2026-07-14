import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { Check, Copy, QrCode, Settings2 } from "lucide-react-native";
import { Button, Sheet } from "@/components/ui";
import { buildPixPayload } from "@/lib/pix";
import { isPixConfigComplete, PIX_KEY_LABEL, pixKeyDisplay, resolveRecebedor, type PixConfig } from "@/lib/pix-config";
import { encodeQr, matrixToSvgPath } from "@/lib/qrcode";
import { formatCurrency } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { colors, fonts, radius, shadows } from "@/lib/theme";

// QR renderizado 100% no app com react-native-svg: quadrado branco + módulos
// escuros. Alto contraste (preto no branco) porque leitor de banco depende
// disso — nada de cor da marca aqui dentro do código.
function QrImage({ value, size = 232 }: { value: string; size?: number }) {
  const { quiet, total, path } = useMemo(() => {
    const matrix = encodeQr(value, "MEDIUM");
    const q = 4; // zona clara (quiet zone) obrigatória ao redor
    return { quiet: q, total: matrix.size + q * 2, path: matrixToSvgPath(matrix) };
  }, [value]);

  // viewBox começa em -quiet para os módulos (desenhados a partir de 0) ficarem
  // centralizados dentro da zona clara. O fundo branco cobre toda a viewBox.
  return (
    <Svg width={size} height={size} viewBox={`${-quiet} ${-quiet} ${total} ${total}`}>
      <Rect x={-quiet} y={-quiet} width={total} height={total} fill="#ffffff" />
      <Path d={path} fill="#000000" />
    </Svg>
  );
}

export function PixSheet({
  visible,
  onClose,
  amount,
  itemCount,
  config,
  onConfigure,
  onRegister,
  registering,
  canRegister
}: {
  visible: boolean;
  onClose: () => void;
  amount: number;
  itemCount: number;
  // Chave Pix da própria pessoa (null/incompleta => mostra o convite a cadastrar).
  config: PixConfig | null;
  onConfigure: () => void;
  // Registra a venda (mesma chamada do botão comum). Recebe callback de sucesso
  // para o sheet se fechar sozinho quando a venda entra.
  onRegister: (onDone: () => void) => void;
  registering: boolean;
  canRegister: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const configured = isPixConfigComplete(config);

  // Só monta o payload quando há valor E chave cadastrada: buildPixPayload
  // recusa zero e recusa recebedor vazio.
  const payload = useMemo(() => {
    if (!visible || amount <= 0 || !configured || !config) return null;
    try {
      return buildPixPayload({ amount, recebedor: resolveRecebedor(config) });
    } catch {
      return null;
    }
  }, [visible, amount, configured, config]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (!visible) setCopied(false);
  }, [visible]);

  async function copyCode() {
    if (!payload) return;
    haptics.tap();
    // Web: copia direto pra área de transferência.
    try {
      const nav = typeof navigator !== "undefined" ? (navigator as Navigator) : undefined;
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(payload);
        setCopied(true);
        return;
      }
    } catch {
      // cai pro compartilhar abaixo
    }
    // Celular: abre o menu do sistema (copiar, WhatsApp, etc.).
    try {
      await Share.share(Platform.OS === "ios" ? { url: payload, message: payload } : { message: payload });
      setCopied(true);
    } catch {
      // usuário cancelou: nada a fazer
    }
  }

  const itemLabel = `${itemCount} ${itemCount === 1 ? "item" : "itens"}`;

  return (
    <Sheet
      visible={visible}
      title="Receber por Pix"
      subtitle={`${formatCurrency(amount)} · ${itemLabel}`}
      onClose={onClose}
      headerAccent={
        <View style={styles.headerBadge}>
          <QrCode size={22} color={colors.brandDeep} strokeWidth={2.4} />
        </View>
      }
    >
      {!configured ? (
        <View style={styles.setupBox}>
          <View style={styles.setupIcon}>
            <Settings2 size={26} color={colors.brandDeep} strokeWidth={2.2} />
          </View>
          <Text style={styles.setupTitle}>Cadastre seu Pix primeiro</Text>
          <Text style={styles.setupHint}>
            Para gerar o QR Code, informe sua chave Pix e o nome que recebe. Você faz isso uma vez só.
          </Text>
          <Button title="Configurar meu Pix" onPress={onConfigure} />
        </View>
      ) : payload && config ? (
        <>
          <Text style={styles.instruction}>Mostre o código para o cliente escanear no app do banco.</Text>

          <View style={styles.qrCard}>
            <QrImage value={payload} />
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Valor a receber</Text>
              <Text style={styles.amount}>{formatCurrency(amount)}</Text>
            </View>
          </View>

          <View style={styles.recebedor}>
            <View style={styles.recebedorHead}>
              <Text style={styles.recebedorLabel}>Recebedor</Text>
              <Pressable onPress={onConfigure} hitSlop={8}>
                <Text style={styles.recebedorEdit}>Editar</Text>
              </Pressable>
            </View>
            <Text style={styles.recebedorNome}>{config.nome}</Text>
            <Text style={styles.recebedorChave}>
              {PIX_KEY_LABEL[config.tipoChave]}: {pixKeyDisplay(config.tipoChave, config.chave)}
            </Text>
          </View>

          <View style={styles.copyBlock}>
            <Text style={styles.copyLabel}>Pix copia e cola</Text>
            <Text style={styles.copyCode} selectable numberOfLines={2} ellipsizeMode="middle">
              {payload}
            </Text>
            <Pressable
              onPress={copyCode}
              style={({ pressed }) => [styles.copyButton, pressed && styles.copyButtonPressed]}
            >
              {copied ? (
                <>
                  <Check size={18} color={colors.success} strokeWidth={2.6} />
                  <Text style={[styles.copyButtonText, { color: colors.success }]}>Código copiado</Text>
                </>
              ) : (
                <>
                  <Copy size={18} color={colors.brandDeep} strokeWidth={2.4} />
                  <Text style={styles.copyButtonText}>Copiar código Pix</Text>
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerNote}>
              Depois que o cliente pagar, registre a venda. A venda é contada igual, com Pix ou não.
            </Text>
            <Button
              title={registering ? "Registrando..." : "Registrar venda"}
              disabled={!canRegister || registering}
              onPress={() => onRegister(onClose)}
            />
          </View>
        </>
      ) : (
        <Text style={styles.instruction}>Adicione itens à sacola para gerar o Pix.</Text>
      )}
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
  instruction: {
    color: colors.muted,
    fontSize: 15,
    fontFamily: fonts.body,
    textAlign: "center"
  },
  qrCard: {
    alignItems: "center",
    gap: 14,
    borderRadius: radius.xl,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    ...shadows.soft
  },
  amountRow: {
    alignItems: "center",
    gap: 2
  },
  amountLabel: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  amount: {
    color: colors.ink,
    fontSize: 30,
    fontFamily: fonts.display,
    letterSpacing: -0.5
  },
  setupBox: {
    alignItems: "center",
    gap: 10,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceGlow,
    padding: 22
  },
  setupIcon: {
    height: 56,
    width: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: colors.brandSoft
  },
  setupTitle: {
    color: colors.ink,
    fontSize: 18,
    fontFamily: fonts.display,
    textAlign: "center"
  },
  setupHint: {
    color: colors.muted,
    fontSize: 14.5,
    lineHeight: 21,
    fontFamily: fonts.body,
    textAlign: "center",
    marginBottom: 4
  },
  recebedor: {
    gap: 2,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceWarm,
    padding: 14
  },
  recebedorHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  recebedorEdit: {
    color: colors.brandDeep,
    fontSize: 13,
    fontFamily: fonts.bodyBold
  },
  recebedorLabel: {
    color: colors.muted,
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  recebedorNome: {
    color: colors.ink,
    fontSize: 16,
    fontFamily: fonts.bodyBold
  },
  recebedorChave: {
    color: colors.muted,
    fontSize: 14,
    fontFamily: fonts.body
  },
  copyBlock: {
    gap: 8
  },
  copyLabel: {
    color: colors.ink,
    fontSize: 13,
    fontFamily: fonts.bodyBold
  },
  copyCode: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: Platform.select({ ios: "Courier", android: "monospace", default: "monospace" }),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: 12
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.brand,
    backgroundColor: colors.surface,
    paddingHorizontal: 16
  },
  copyButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9
  },
  copyButtonText: {
    color: colors.brandDeep,
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  footer: {
    gap: 12,
    marginTop: 4
  },
  footerNote: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.body,
    textAlign: "center"
  }
});
