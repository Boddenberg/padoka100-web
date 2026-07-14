import Constants from "expo-constants";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState
} from "expo-audio";
import { Image } from "expo-image";
import { Camera, Check, Images, Mic, Pause, Play, Square, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Field, Input, Sheet, StateText } from "@/components/ui";
import { api, friendlyErrorMessage, type NativeFile } from "@/lib/api";
import { colors, fonts, radius } from "@/lib/theme";
import type { ReportTipo } from "@/types/api";
import { pickImage } from "@/utils/media";

const TIPOS: { key: ReportTipo; label: string; emoji: string }[] = [
  { key: "erro", label: "Encontrei um erro", emoji: "🐞" },
  { key: "dificuldade", label: "Tive dificuldade", emoji: "🤔" },
  { key: "sugestao", label: "Tenho uma sugestão", emoji: "💡" },
  { key: "recado", label: "Recado para vocês", emoji: "💌" }
];

const MAX_IMAGENS = 4;

// Sheet de "Relatar um problema": a pessoa escolhe o tipo, escreve (opcional),
// anexa print/foto e/ou grava um áudio, e envia. Um ou vários formatos no mesmo
// envio. No fim, uma confirmação clara de que a mensagem chegou. `contexto`
// registra de qual jornada o report saiu (Venda, Perfil...).
export function ReportSheet({ visible, onClose, contexto }: { visible: boolean; onClose: () => void; contexto?: string }) {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<ReportTipo>("erro");
  const [mensagem, setMensagem] = useState("");
  const [imagens, setImagens] = useState<NativeFile[]>([]);
  const [audio, setAudio] = useState<NativeFile | null>(null);
  const [anexoErro, setAnexoErro] = useState<string | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const player = useAudioPlayer(undefined, { updateInterval: 500 });
  const playerStatus = useAudioPlayerStatus(player);
  const [playingPreview, setPlayingPreview] = useState(false);

  const submit = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append("tipo", tipo);
      if (mensagem.trim()) form.append("mensagem", mensagem.trim());
      if (contexto) form.append("contexto", contexto);
      form.append("plataforma", Platform.OS);
      const versao = Constants.expoConfig?.version;
      if (versao) form.append("app_versao", String(versao));
      imagens.forEach((imagem) => form.append("arquivos", imagem as unknown as Blob));
      if (audio) form.append("arquivos", audio as unknown as Blob);
      return api.reports.criar(form);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reports"] })
  });
  const resetSubmit = submit.reset;

  function stopPreview() {
    try {
      player.pause();
    } catch {
      // sem fonte ainda — tudo bem.
    }
    setPlayingPreview(false);
  }

  // Cada abertura começa limpa, sem sobras do envio anterior.
  useEffect(() => {
    if (visible) {
      setTipo("erro");
      setMensagem("");
      setImagens([]);
      setAudio(null);
      setAnexoErro(null);
      resetSubmit();
    } else {
      stopPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Terminou de ouvir a prévia: solta o botão.
  useEffect(() => {
    if (playerStatus.didJustFinish) setPlayingPreview(false);
  }, [playerStatus.didJustFinish]);

  async function adicionarImagem(source: "camera" | "gallery") {
    try {
      setAnexoErro(null);
      if (imagens.length >= MAX_IMAGENS) {
        setAnexoErro(`Você pode anexar até ${MAX_IMAGENS} imagens.`);
        return;
      }
      // Print/foto vai inteiro (sem recorte), para nada da tela se perder.
      const file = await pickImage(source, "report", { allowsEditing: false, quality: 0.7 });
      if (file) setImagens((atual) => [...atual, file]);
    } catch (error) {
      setAnexoErro(error instanceof Error ? error.message : "Não foi possível anexar a imagem.");
    }
  }

  function removerImagem(uri: string) {
    setImagens((atual) => atual.filter((imagem) => imagem.uri !== uri));
  }

  async function alternarGravacao() {
    if (recorderState.isRecording) {
      try {
        await recorder.stop();
        if (recorder.uri) setAudio({ uri: recorder.uri, name: `report-${Date.now()}.m4a`, type: "audio/mp4" });
      } catch (error) {
        Alert.alert("Áudio", error instanceof Error ? error.message : "Não foi possível salvar o áudio.");
      }
      return;
    }
    try {
      setAnexoErro(null);
      stopPreview();
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Microfone", "Permissão para usar o microfone foi negada.");
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (error) {
      Alert.alert("Áudio", error instanceof Error ? error.message : "Não foi possível gravar.");
    }
  }

  function alternarPreviaAudio() {
    if (!audio) return;
    if (playingPreview) {
      stopPreview();
      return;
    }
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
    player.replace({ uri: audio.uri });
    player.play();
    setPlayingPreview(true);
  }

  function removerAudio() {
    stopPreview();
    setAudio(null);
  }

  function fechar() {
    stopPreview();
    if (recorderState.isRecording) recorder.stop().catch(() => undefined);
    onClose();
  }

  const gravando = recorderState.isRecording;
  const podeEnviar = (mensagem.trim().length > 0 || imagens.length > 0 || audio != null) && !gravando && !submit.isPending;

  return (
    <Sheet
      visible={visible}
      title="Relatar um problema"
      subtitle="Encontrou um erro ou tem uma ideia? Conte pra gente."
      onClose={fechar}
    >
      {submit.isSuccess ? (
        <View style={styles.successBox}>
          <View style={styles.successCircle}>
            <Check size={34} color={colors.success} strokeWidth={3} />
          </View>
          <Text style={styles.successTitle}>Mensagem enviada!</Text>
          <Text style={styles.successHint}>
            Obrigado por ajudar a melhorar o Padoka. Nossa equipe vai dar uma olhada com carinho.
          </Text>
          <Button title="Fechar" onPress={fechar} />
        </View>
      ) : (
        <>
          <Field label="Sobre o que é?">
            <View style={styles.tipoRow}>
              {TIPOS.map((opcao) => {
                const ativo = tipo === opcao.key;
                return (
                  <Pressable
                    key={opcao.key}
                    onPress={() => setTipo(opcao.key)}
                    style={[styles.tipoChip, ativo && styles.tipoChipActive]}
                  >
                    <Text style={styles.tipoEmoji}>{opcao.emoji}</Text>
                    <Text style={[styles.tipoLabel, ativo && styles.tipoLabelActive]}>{opcao.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <Field label="Descreva com suas palavras (opcional)">
            <Input
              value={mensagem}
              onChangeText={setMensagem}
              placeholder="Ex: o botão de fechar o dia não estava funcionando..."
              multiline
              style={styles.mensagem}
              maxLength={2000}
            />
          </Field>

          {/* Anexos: print/foto e/ou áudio. Pode usar mais de um no mesmo envio. */}
          <Field label="Anexar (opcional)">
            <View style={styles.anexoRow}>
              <AnexoButton icon={<Images size={18} color={colors.brandDeep} />} label="Print / Foto" onPress={() => adicionarImagem("gallery")} />
              <AnexoButton icon={<Camera size={18} color={colors.brandDeep} />} label="Câmera" onPress={() => adicionarImagem("camera")} />
            </View>

            {imagens.length > 0 ? (
              <View style={styles.thumbs}>
                {imagens.map((imagem) => (
                  <View key={imagem.uri} style={styles.thumbWrap}>
                    <Image source={{ uri: imagem.uri }} style={styles.thumb} contentFit="cover" />
                    <Pressable onPress={() => removerImagem(imagem.uri)} style={styles.thumbRemove} hitSlop={6}>
                      <X size={13} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            {audio ? (
              <View style={styles.audioChip}>
                <Pressable onPress={alternarPreviaAudio} style={({ pressed }) => [styles.audioPlay, pressed && styles.pressed]}>
                  {playingPreview ? <Pause size={18} color="#fff" fill="#fff" /> : <Play size={18} color="#fff" fill="#fff" />}
                </Pressable>
                <Text style={styles.audioLabel}>Áudio gravado</Text>
                <Pressable onPress={removerAudio} style={({ pressed }) => [styles.audioRemove, pressed && styles.pressed]} hitSlop={6}>
                  <X size={16} color={colors.muted} />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={alternarGravacao} style={({ pressed }) => [styles.recordButton, gravando && styles.recordButtonActive, pressed && styles.pressed]}>
                {gravando ? <Square size={18} color="#fff" fill="#fff" /> : <Mic size={18} color={colors.brandDeep} />}
                <Text style={[styles.recordText, gravando && styles.recordTextActive]}>
                  {gravando ? "Gravando... toque para parar" : "Gravar um áudio"}
                </Text>
              </Pressable>
            )}

            {anexoErro ? <StateText tone="error" text={anexoErro} /> : null}
          </Field>

          {submit.error ? <StateText tone="error" text={friendlyErrorMessage(submit.error)} /> : null}

          <Button
            title={submit.isPending ? "Enviando..." : "Enviar para a equipe"}
            disabled={!podeEnviar}
            onPress={() => submit.mutate()}
          />
        </>
      )}
    </Sheet>
  );
}

function AnexoButton({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.anexoButton, pressed && styles.pressed]}>
      {icon}
      <Text style={styles.anexoButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.75
  },
  tipoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  tipoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  tipoChipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft
  },
  tipoEmoji: {
    fontSize: 16
  },
  tipoLabel: {
    color: colors.muted,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  tipoLabelActive: {
    color: colors.brandDeep
  },
  mensagem: {
    minHeight: 96,
    paddingTop: 14,
    textAlignVertical: "top"
  },
  anexoRow: {
    flexDirection: "row",
    gap: 10
  },
  anexoButton: {
    flex: 1,
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
  anexoButtonText: {
    color: colors.brandDeep,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  thumbs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4
  },
  thumbWrap: {
    height: 72,
    width: 72,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceWarm
  },
  thumb: {
    height: "100%",
    width: "100%"
  },
  thumbRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    height: 22,
    width: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: "rgba(35,20,10,0.65)"
  },
  audioChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
    padding: 10,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  audioPlay: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.agentDeep
  },
  audioLabel: {
    flex: 1,
    color: colors.ink,
    fontSize: 14.5,
    fontFamily: fonts.bodyBold
  },
  audioRemove: {
    height: 34,
    width: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm
  },
  recordButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.brandSoft,
    backgroundColor: colors.surface
  },
  recordButtonActive: {
    borderColor: colors.danger,
    backgroundColor: colors.danger
  },
  recordText: {
    color: colors.brandDeep,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  recordTextActive: {
    color: "#fff"
  },
  successBox: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 8
  },
  successCircle: {
    height: 72,
    width: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 36,
    backgroundColor: colors.successSoft
  },
  successTitle: {
    color: colors.ink,
    fontSize: 20,
    fontFamily: fonts.display
  },
  successHint: {
    color: colors.muted,
    fontSize: 14.5,
    lineHeight: 21,
    fontFamily: fonts.body,
    textAlign: "center"
  }
});
