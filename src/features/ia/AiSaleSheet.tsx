import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Mic, MicOff, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { ErrorState } from "@/components/ui/StateBlocks";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api, createAudioForm } from "@/lib/api/client";
import { formatCurrency } from "@/lib/utils/format";
import type { RespostaInterpretarVenda } from "@/types/api";

interface AiSaleSheetProps {
  open: boolean;
  onClose: () => void;
  currentDayId: string | null;
  autoStartRecording?: boolean;
  onSaleCreated?: (message: string) => void;
}

export function AiSaleSheet({ open, onClose, currentDayId, autoStartRecording, onSaleCreated }: AiSaleSheetProps) {
  return (
    <Modal title="Falar a venda" open={open} onClose={onClose} size="lg">
      {open ? (
        <AiSaleContent
          onClose={onClose}
          currentDayId={currentDayId}
          autoStartRecording={autoStartRecording}
          onSaleCreated={onSaleCreated}
        />
      ) : null}
    </Modal>
  );
}

function AiSaleContent({
  onClose,
  currentDayId,
  autoStartRecording,
  onSaleCreated
}: Omit<AiSaleSheetProps, "open">) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [result, setResult] = useState<RespostaInterpretarVenda | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const discardRef = useRef(false);
  const autoStartedRef = useRef(false);

  const interpretText = useMutation({
    mutationFn: () =>
      api.ia.interpretSale({
        texto: text,
        dia_de_venda_id: currentDayId,
        permitir_fallback: true
      }),
    onSuccess: setResult
  });

  const confirmSale = useMutation({
    mutationFn: () => api.ia.confirmSale(result!.interacao_ia_id),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
      queryClient.invalidateQueries({ queryKey: ["dias"] });
      const total = (response.venda.itens || []).reduce((sum, item) => sum + Number(item.valor_total_venda || 0), 0);
      onSaleCreated?.(`Venda registrada por IA: ${formatCurrency(total)}.`);
      onClose();
    }
  });

  const uploadAudio = useMutation({
    mutationFn: (blob: Blob) => api.ia.transcribeAudio(createAudioForm(blob, currentDayId)),
    onSuccess: (response) => {
      setText(response.transcricao);
      setResult(response.interpretacao || null);
    }
  });

  const canRecord =
    typeof window !== "undefined" && "MediaRecorder" in window && Boolean(navigator.mediaDevices?.getUserMedia);

  async function startRecording() {
    setRecordingError(null);

    if (!canRecord) {
      setRecordingError("Gravação de áudio indisponível neste navegador.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      discardRef.current = false;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (!discardRef.current && blob.size > 0) uploadAudio.mutate(blob);
      };
      recorder.start();
      setRecording(true);
    } catch (err) {
      setRecordingError(err instanceof Error ? err.message : "Não foi possível iniciar o microfone.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  useEffect(() => {
    if (autoStartRecording && !autoStartedRef.current) {
      autoStartedRef.current = true;
      void startRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartRecording]);

  useEffect(
    () => () => {
      // O sheet fechou no meio da gravação: descarta o áudio e libera o microfone.
      discardRef.current = true;
      recorderRef.current?.stop();
      recorderRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    },
    []
  );

  return (
    <div className="grid grid-cols-1 gap-5">
      <form
        className="grid grid-cols-1 gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          interpretText.mutate();
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-bakery-muted">Fale ou escreva a venda e a IA monta a sacola.</p>
          <StatusBadge tone={currentDayId ? "good" : "warn"}>{currentDayId ? "Dia aberto" : "Sem dia"}</StatusBadge>
        </div>

        {recording ? (
          <button
            type="button"
            onClick={stopRecording}
            className="grid justify-items-center gap-3 rounded-bakeryXl bg-bakery-dangerSoft p-6 text-center transition active:scale-[0.99]"
          >
            <span className="relative grid h-16 w-16 place-items-center rounded-full bg-bakery-danger text-white">
              <span className="absolute inset-0 animate-ping rounded-full bg-bakery-danger/40" />
              <MicOff className="relative h-7 w-7" />
            </span>
            <span className="text-base font-extrabold text-bakery-danger">Gravando... toque para parar</span>
            <span className="text-sm font-semibold text-bakery-muted">Ex: “vende 2 pães de queijo e 1 café”</span>
          </button>
        ) : (
          <>
            <Field label="Comando">
              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Ex: vende 2 pães de queijo e 1 café"
                className="min-h-28"
              />
            </Field>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" disabled={!text.trim() || interpretText.isPending} icon={<Send className="h-4 w-4" />}>
                {interpretText.isPending ? "Interpretando..." : "Interpretar"}
              </Button>
              <Button
                type="button"
                variant="dark"
                disabled={!canRecord || uploadAudio.isPending}
                onClick={startRecording}
                icon={<Mic className="h-4 w-4" />}
              >
                {uploadAudio.isPending ? "Enviando áudio..." : "Gravar áudio"}
              </Button>
            </div>
          </>
        )}
        {interpretText.error instanceof Error ? <ErrorState message={interpretText.error.message} /> : null}
        {uploadAudio.error instanceof Error ? <ErrorState message={uploadAudio.error.message} /> : null}
        {recordingError ? <ErrorState message={recordingError} /> : null}
      </form>

      {result ? (
        <div className="grid gap-3 border-t border-bakery-border/70 pt-4">
          <div className="rounded-bakeryLg bg-bakery-creamStrong/60 p-4">
            <p className="text-sm font-semibold text-bakery-muted">Entendi assim</p>
            <p className="mt-1 font-semibold text-bakery-ink">{result.mensagem_assistente}</p>
          </div>
          <div className="grid gap-2">
            {(result.itens || []).map((item) => (
              <div
                key={`${item.produto_id}-${item.nome_produto}`}
                className="flex items-center justify-between gap-3 rounded-bakeryLg border border-bakery-border/70 p-3"
              >
                <div className="min-w-0">
                  <strong className="text-bakery-ink">{item.nome_produto}</strong>
                  <p className="text-sm font-semibold text-bakery-muted">Quantidade: {item.quantidade}</p>
                </div>
                <StatusBadge tone={item.confianca >= 0.75 ? "good" : "warn"}>{Math.round(item.confianca * 100)}%</StatusBadge>
              </div>
            ))}
          </div>
          {result.itens_nao_identificados?.length ? (
            <div className="rounded-bakeryLg bg-bakery-warningSoft p-3 text-sm font-semibold text-bakery-warning">
              Não identificado: {result.itens_nao_identificados.join(", ")}
            </div>
          ) : null}
          <Button
            type="button"
            variant="success"
            size="lg"
            disabled={confirmSale.isPending || !result.interacao_ia_id}
            onClick={() => confirmSale.mutate()}
            icon={<CheckCircle2 className="h-5 w-5" />}
          >
            {confirmSale.isPending ? "Confirmando..." : "Confirmar venda"}
          </Button>
          {confirmSale.error instanceof Error ? <ErrorState message={confirmSale.error.message} /> : null}
        </div>
      ) : null}
    </div>
  );
}
