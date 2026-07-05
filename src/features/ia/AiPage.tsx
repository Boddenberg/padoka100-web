import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, CheckCircle2, Mic, MicOff, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Field, Textarea } from "@/components/ui/Form";
import { Page } from "@/components/ui/Page";
import { EmptyState, ErrorState } from "@/components/ui/StateBlocks";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api, createAudioForm } from "@/lib/api/client";
import { formatCurrency } from "@/lib/utils/format";
import type { RespostaInterpretarVenda } from "@/types/api";

export function AiPage() {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [result, setResult] = useState<RespostaInterpretarVenda | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const currentDayQuery = useQuery({
    queryKey: ["dias", "atual"],
    queryFn: api.dias.current
  });

  const interpretText = useMutation({
    mutationFn: () =>
      api.ia.interpretSale({
        texto: text,
        dia_de_venda_id: currentDayQuery.data?.id || null,
        permitir_fallback: true
      }),
    onSuccess: setResult
  });

  const confirmSale = useMutation({
    mutationFn: () => api.ia.confirmSale(result!.interacao_ia_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
      queryClient.invalidateQueries({ queryKey: ["dias"] });
    }
  });

  const uploadAudio = useMutation({
    mutationFn: (blob: Blob) => api.ia.transcribeAudio(createAudioForm(blob, currentDayQuery.data?.id || null)),
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
      setRecordingError("Gravacao de audio indisponivel neste navegador.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (blob.size > 0) uploadAudio.mutate(blob);
      };
      recorder.start();
      setRecording(true);
    } catch (err) {
      setRecordingError(err instanceof Error ? err.message : "Nao foi possivel iniciar o microfone.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  return (
    <Page title="IA" eyebrow="Venda por texto e audio">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-6 w-6 text-bakery-brand" />
              <h2 className="text-xl font-black text-bakery-ink">Interpretar venda</h2>
            </div>
            <StatusBadge tone={currentDayQuery.data ? "good" : "warn"}>
              {currentDayQuery.data ? "Dia aberto" : "Sem dia"}
            </StatusBadge>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                interpretText.mutate();
              }}
            >
              <Field label="Comando">
                <Textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Ex: vende 2 paes de queijo e 1 cafe"
                  className="min-h-40"
                />
              </Field>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" disabled={!text.trim() || interpretText.isPending} icon={<Send className="h-4 w-4" />}>
                  {interpretText.isPending ? "Interpretando" : "Interpretar"}
                </Button>
                {recording ? (
                  <Button type="button" variant="danger" onClick={stopRecording} icon={<MicOff className="h-4 w-4" />}>
                    Parar audio
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!canRecord || uploadAudio.isPending}
                    onClick={startRecording}
                    icon={<Mic className="h-4 w-4" />}
                  >
                    {uploadAudio.isPending ? "Enviando audio" : "Gravar audio"}
                  </Button>
                )}
              </div>
              {interpretText.error instanceof Error ? <ErrorState message={interpretText.error.message} /> : null}
              {uploadAudio.error instanceof Error ? <ErrorState message={uploadAudio.error.message} /> : null}
              {recordingError ? <ErrorState message={recordingError} /> : null}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-black text-bakery-ink">Confirmacao</h2>
          </CardHeader>
          <CardContent className="grid gap-4">
            {result ? (
              <>
                <div className="rounded-bakeryLg bg-bakery-cream p-4">
                  <p className="text-sm font-bold text-bakery-muted">Resposta</p>
                  <p className="mt-1 font-semibold text-bakery-ink">{result.mensagem_assistente}</p>
                </div>
                <div className="grid gap-2">
                  {(result.itens || []).map((item) => (
                    <div key={`${item.produto_id}-${item.nome_produto}`} className="rounded-bakeryLg border border-bakery-border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-bakery-ink">{item.nome_produto}</strong>
                        <StatusBadge tone={item.confianca >= 0.75 ? "good" : "warn"}>
                          {Math.round(item.confianca * 100)}%
                        </StatusBadge>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-bakery-muted">Quantidade: {item.quantidade}</p>
                    </div>
                  ))}
                </div>
                {result.itens_nao_identificados?.length ? (
                  <div className="rounded-bakeryLg bg-bakery-warningSoft p-3 text-sm font-semibold text-bakery-warning">
                    Nao identificado: {result.itens_nao_identificados.join(", ")}
                  </div>
                ) : null}
                <Button
                  type="button"
                  variant="success"
                  disabled={confirmSale.isPending || !result.interacao_ia_id}
                  onClick={() => confirmSale.mutate()}
                  icon={<CheckCircle2 className="h-4 w-4" />}
                >
                  {confirmSale.isPending ? "Confirmando" : "Confirmar venda"}
                </Button>
                {confirmSale.data ? (
                  <div className="rounded-bakeryLg bg-bakery-successSoft p-3 text-sm font-black text-bakery-success">
                    Venda criada: {formatCurrency((confirmSale.data.venda.itens || []).reduce((sum, item) => sum + Number(item.valor_total_venda || 0), 0))}
                  </div>
                ) : null}
                {confirmSale.error instanceof Error ? <ErrorState message={confirmSale.error.message} /> : null}
              </>
            ) : (
              <EmptyState title="Nada para confirmar" description="Interprete texto ou audio antes de criar a venda." />
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
