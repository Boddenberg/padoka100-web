import { ArrowLeft, Camera, Images, MapPin, Trash2 } from "lucide-react-native";
import type { ReactNode } from "react";
import {
  Alert,
  Keyboard,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { ProductPhoto, Screen } from "@/components/ui";
import { featurePlanName, upgradeMessage } from "@/lib/access";
import { api, createMediaForm, type NativeFile } from "@/lib/api";
import { useFontMultiplier } from "@/lib/font-scale";
import { toNumber } from "@/lib/format";
import { colors, fonts, radius } from "@/lib/theme";
import type { VersaoDePreco } from "@/types/api";

// ---------------------------------------------------------------------------
// Peças comuns das telas de "Minha padoca" (produtos, locais, custos).
// Vieram do antigo Catálogo, que virou o hub — nada aqui é novo em visual.
// ---------------------------------------------------------------------------

// Tela filha do hub: seta de volta para "Minha padoca" + título, com o mesmo
// esqueleto de rolagem/teclado do Page.
export function SubPage({
  title,
  subtitle,
  onRefresh,
  refreshing,
  children
}: {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const scale = useFontMultiplier();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/catalogo"));

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} />
          ) : undefined
        }
      >
        <Pressable style={styles.page} onPress={Keyboard.dismiss} accessible={false}>
          <Pressable onPress={goBack} style={({ pressed }) => [styles.backRow, pressed && styles.pressed]}>
            <ArrowLeft size={18} color={colors.brandDeep} />
            <Text style={[styles.backText, { fontSize: 14 * scale }]}>Minha padoca</Text>
          </Pressable>
          <Text style={[styles.title, { fontSize: 30 * scale }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { fontSize: 15 * scale }]}>{subtitle}</Text> : null}
          {children}
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

// Alert.alert com botões não funciona no navegador; lá usamos o confirm nativo.
export function confirmDestructive(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    const webConfirm = (globalThis as { confirm?: (text: string) => boolean }).confirm;
    if (!webConfirm || webConfirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "Voltar", style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm }
  ]);
}

export function showUpgrade(capability: string) {
  const plan = featurePlanName(capability);
  Alert.alert(plan ? `Funcionalidade do plano ${plan}` : "Funcionalidade de outro plano", upgradeMessage(capability));
}

// Preço/custo digitados aceitam vírgula ou ponto; no envio viram número.
export function inputToDecimal(value: string) {
  return toNumber(value.replace(/\s/g, "").replace(",", "."));
}

// Valor atual do produto → texto do campo, no formato pt-BR ("3,50"). Zero/vazio
// vira "" para o campo mostrar só o placeholder.
export function decimalToInput(value: string | number | null | undefined) {
  const amount = toNumber(value);
  return amount > 0 ? amount.toFixed(2).replace(".", ",") : "";
}

// O assistente marca o custo com origem "ia". Versões antigas (gravadas antes do
// campo existir) só têm o texto do motivo, então caímos nele como fallback.
export function isCostFromAI(preco?: VersaoDePreco | null) {
  if (!preco) return false;
  if (preco.origem === "ia") return true;
  if (preco.origem === "manual") return false;
  return /assistente|calculad[oa]\s+com\s+ia|\bia\b/i.test(preco.motivo || "");
}

// Envia a foto pelo endpoint de mídia e grava a URL no cadastro do local.
export async function uploadLocationPhoto(localId: string, file: NativeFile) {
  const media = await api.locais.uploadMedia(localId, createMediaForm(file));
  const mediaUrl = media?.url_publica || media?.caminho_arquivo || null;
  if (mediaUrl) {
    await api.locais.update(localId, { url_imagem_principal: mediaUrl });
  }
  return mediaUrl;
}

export function PhotoPickerButtons({ onPick, disabled }: { onPick: (source: "camera" | "gallery") => void; disabled?: boolean }) {
  return (
    <View style={styles.photoActions}>
      <Pressable
        onPress={() => onPick("camera")}
        disabled={disabled}
        style={({ pressed }) => [styles.photoAction, pressed && styles.pressed]}
      >
        <Camera size={20} color={colors.brandDeep} />
        <Text style={styles.photoActionText}>Fotografar</Text>
      </Pressable>
      <Pressable
        onPress={() => onPick("gallery")}
        disabled={disabled}
        style={({ pressed }) => [styles.photoAction, pressed && styles.pressed]}
      >
        <Images size={20} color={colors.brandDeep} />
        <Text style={styles.photoActionText}>Galeria</Text>
      </Pressable>
    </View>
  );
}

// Link discreto de tirar a foto atual, sempre logo abaixo dos botões de foto.
export function RemovePhotoLink({ onPress, pending }: { onPress: () => void; pending?: boolean }) {
  return (
    <Pressable onPress={pending ? undefined : onPress} style={({ pressed }) => [styles.removePhoto, pressed && styles.pressed]}>
      <Trash2 size={16} color={colors.danger} />
      <Text style={styles.removePhotoText}>{pending ? "Removendo foto..." : "Remover foto"}</Text>
    </Pressable>
  );
}

// Foto do local com fallback de mapinha quando não há imagem.
export function LocationPhoto({ url, size }: { url?: string | null; size: number }) {
  if (!url) {
    return (
      <View style={[styles.locationIcon, { height: size, width: size }]}>
        <MapPin size={22} color={colors.brandDeep} />
      </View>
    );
  }
  return <ProductPhoto url={url} name="Local" size={size} rounded={radius.lg} />;
}

export const sharedStyles = StyleSheet.create({
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92
  },
  editHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  editHeaderInfo: {
    gap: 6
  },
  statusRow: {
    flexDirection: "row",
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm,
    padding: 5
  },
  statusChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    paddingVertical: 10
  },
  statusChipActive: {
    backgroundColor: colors.brand
  },
  statusChipText: {
    color: colors.muted,
    fontFamily: fonts.bodyBold
  },
  statusChipTextActive: {
    color: "#fff"
  },
  dangerSection: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
    marginTop: 4
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12
  },
  itemInfo: {
    flex: 1,
    gap: 4
  },
  itemTitle: {
    color: colors.ink,
    fontSize: 16,
    fontFamily: fonts.bodyBold
  },
  itemPrice: {
    color: colors.ink,
    fontSize: 18,
    fontFamily: fonts.display,
    letterSpacing: -0.3
  },
  itemHint: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.body
  }
});

const styles = StyleSheet.create({
  pressed: sharedStyles.pressed,
  scroll: {
    flexGrow: 1
  },
  page: {
    flexGrow: 1,
    gap: 16,
    padding: 16,
    paddingBottom: 32
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    minHeight: 40,
    paddingRight: 12
  },
  backText: {
    color: colors.brandDeep,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    fontFamily: fonts.display,
    letterSpacing: -0.5,
    marginTop: -6
  },
  subtitle: {
    marginTop: -10,
    color: colors.muted,
    fontSize: 15,
    fontFamily: fonts.body
  },
  photoActions: {
    flexDirection: "row",
    gap: 10
  },
  photoAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 50,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.brandSoft,
    backgroundColor: colors.surfaceGlow
  },
  photoActionText: {
    color: colors.brandDeep,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  removePhoto: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "center",
    minHeight: 40,
    paddingHorizontal: 16
  },
  removePhotoText: {
    color: colors.danger,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  locationIcon: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft
  }
});
