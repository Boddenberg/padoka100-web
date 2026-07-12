import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, Mask, Rect } from "react-native-svg";
import { haptics } from "@/lib/haptics";
import { colors, fonts, radius, shadows } from "@/lib/theme";
import { useFontMultiplier } from "@/lib/font-scale";

// ---------------------------------------------------------------------------
// Passeio guiado (coach marks): escurece a tela, abre um "furo" iluminado sobre
// um elemento real e mostra um balão explicando pra que serve. Pensado para o
// público idoso do app: textos curtos, botões grandes, um passo de cada vez.
// ---------------------------------------------------------------------------

export interface CoachStep {
  // Nome do alvo registrado por <CoachAnchor name="..."> — omita para um passo
  // centralizado (boas-vindas / encerramento). "region: tabs" ilumina a barra
  // de abas de baixo, que não dá para referenciar diretamente.
  target?: string;
  region?: "tabs";
  emoji?: string;
  title: string;
  body: string;
  // Recheio ao redor do alvo e raio dos cantos do furo.
  padding?: number;
  cornerRadius?: number;
  // Limita a altura do furo (útil quando o alvo é uma lista comprida: destaca
  // só o topo em vez de meia tela).
  maxSpotlightHeight?: number;
}

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface StartOptions {
  onFinish?: () => void;
  onSkip?: () => void;
}

interface CoachContextValue {
  registerTarget: (name: string, node: View | null) => void;
  startTour: (steps: CoachStep[], options?: StartOptions) => void;
  stop: () => void;
  // Reexibir o tour da Venda: incrementa um contador que a tela de Venda observa.
  replaySalesTour: () => void;
  replayNonce: number;
  isActive: boolean;
}

const CoachContext = createContext<CoachContextValue | null>(null);

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function measureNode(node: View): Promise<Rectangle | null> {
  return new Promise((resolve) => {
    try {
      node.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
    } catch {
      resolve(null);
    }
  });
}

export function CoachProvider({ children }: { children: ReactNode }) {
  const targets = useRef(new Map<string, View>());
  // Âncora invisível de tela cheia: serve só para medir a origem real do
  // overlay (ver measureOverlayOrigin).
  const rootRef = useRef<View>(null);
  const finishRef = useRef<(() => void) | undefined>(undefined);
  const skipRef = useRef<(() => void) | undefined>(undefined);

  const [steps, setSteps] = useState<CoachStep[]>([]);
  const [index, setIndex] = useState(0);
  const [active, setActive] = useState(false);
  const [rect, setRect] = useState<Rectangle | null>(null);
  const [replayNonce, setReplayNonce] = useState(0);

  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const registerTarget = useCallback((name: string, node: View | null) => {
    if (node) targets.current.set(name, node);
    else targets.current.delete(name);
  }, []);

  const tabsRect = useCallback((): Rectangle => {
    // A barra de abas fica encaixada no rodapé (ver app/(tabs)/_layout.tsx).
    const barHeight = 62 + Math.max(insets.bottom, 8);
    return { x: 6, y: height - barHeight - 4, width: width - 12, height: barHeight };
  }, [width, height, insets.bottom]);

  // Origem real do overlay em coordenadas de janela. measureInWindow do alvo e
  // o desenho do overlay podem não compartilhar a mesma origem — no Android a
  // barra de status/edge-to-edge desloca um em relação ao outro, e por isso o
  // furo saía torto em telas maiores. Medindo a âncora de tela cheia e
  // subtraindo essa origem, o furo cai exatamente sobre o componente em
  // qualquer densidade, área segura ou tamanho de tela. No iOS a origem é ~0,
  // então nada muda.
  const measureOverlayOrigin = useCallback(async (): Promise<{ x: number; y: number }> => {
    const node = rootRef.current;
    if (!node) return { x: 0, y: 0 };
    const measured = await measureNode(node);
    return measured ? { x: measured.x, y: measured.y } : { x: 0, y: 0 };
  }, []);

  const resolveRect = useCallback(
    async (step: CoachStep | undefined): Promise<Rectangle | null> => {
      if (!step) return null;
      if (step.region === "tabs") return tabsRect();
      if (!step.target) return null; // passo centralizado
      const node = targets.current.get(step.target);
      if (!node) return null;
      // measureInWindow pode devolver 0 logo após montar/rolar: tenta algumas vezes.
      for (let attempt = 0; attempt < 6; attempt++) {
        const measured = await measureNode(node);
        if (measured && measured.width > 0 && measured.height > 0) {
          const origin = await measureOverlayOrigin();
          return { ...measured, x: measured.x - origin.x, y: measured.y - origin.y };
        }
        await delay(60);
      }
      return null;
    },
    [tabsRect, measureOverlayOrigin]
  );

  const finish = useCallback(() => {
    setActive(false);
    setRect(null);
    const cb = finishRef.current;
    finishRef.current = undefined;
    skipRef.current = undefined;
    haptics.success();
    cb?.();
  }, []);

  const skip = useCallback(() => {
    setActive(false);
    setRect(null);
    const cb = skipRef.current;
    finishRef.current = undefined;
    skipRef.current = undefined;
    cb?.();
  }, []);

  const goNext = useCallback(() => {
    setIndex((current) => {
      if (current + 1 >= steps.length) {
        finish();
        return current;
      }
      haptics.tap();
      return current + 1;
    });
  }, [steps.length, finish]);

  const goBack = useCallback(() => {
    setIndex((current) => (current > 0 ? current - 1 : current));
  }, []);

  const startTour = useCallback((nextSteps: CoachStep[], options?: StartOptions) => {
    if (!nextSteps.length) return;
    finishRef.current = options?.onFinish;
    skipRef.current = options?.onSkip;
    setSteps(nextSteps);
    setIndex(0);
    setActive(true);
    haptics.tap();
  }, []);

  const stop = useCallback(() => setActive(false), []);
  const replaySalesTour = useCallback(() => setReplayNonce((n) => n + 1), []);

  // Ao trocar de passo, mede o alvo. Se um passo ancorado não for encontrado
  // (elemento fora da tela naquele estado), pula para o próximo automaticamente.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const step = steps[index];
    void (async () => {
      const measured = await resolveRect(step);
      if (cancelled) return;
      if (step?.target && !measured) {
        goNext();
        return;
      }
      setRect(measured);
    })();
    return () => {
      cancelled = true;
    };
  }, [active, index, steps, resolveRect, goNext]);

  const value = useMemo<CoachContextValue>(
    () => ({ registerTarget, startTour, stop, replaySalesTour, replayNonce, isActive: active }),
    [registerTarget, startTour, stop, replaySalesTour, replayNonce, active]
  );

  const currentStep = active ? steps[index] : undefined;

  return (
    <CoachContext.Provider value={value}>
      {/* Envolve app + overlay numa mesma âncora de tela cheia (rootRef). O furo
          é medido subtraindo a origem desta âncora, então destaque e componente
          real caem no mesmo lugar em qualquer Android/iOS (ver measureOverlayOrigin). */}
      <View ref={rootRef} collapsable={false} style={styles.root}>
        {children}
        {currentStep ? (
          <CoachOverlay
            step={currentStep}
            rect={rect}
            index={index}
            total={steps.length}
            width={width}
            height={height}
            insetTop={insets.top}
            onNext={goNext}
            onBack={goBack}
            onSkip={skip}
          />
        ) : null}
      </View>
    </CoachContext.Provider>
  );
}

function CoachOverlay({
  step,
  rect,
  index,
  total,
  width,
  height,
  insetTop,
  onNext,
  onBack,
  onSkip
}: {
  step: CoachStep;
  rect: Rectangle | null;
  index: number;
  total: number;
  width: number;
  height: number;
  insetTop: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const scale = useFontMultiplier();
  const isLast = index >= total - 1;
  const centered = !rect;

  // Furo iluminado com recorte arredondado, respeitando as bordas da tela.
  const pad = step.padding ?? 10;
  const corner = step.cornerRadius ?? 22;
  let hole: Rectangle | null = null;
  if (rect) {
    let hx = rect.x - pad;
    let hy = rect.y - pad;
    let hw = rect.width + pad * 2;
    let hh = rect.height + pad * 2;
    if (step.maxSpotlightHeight) hh = Math.min(hh, step.maxSpotlightHeight);
    hx = Math.max(4, hx);
    hy = Math.max(insetTop + 4, hy);
    if (hx + hw > width - 4) hw = width - 4 - hx;
    if (hy + hh > height - 4) hh = height - 4 - hy;
    hole = { x: hx, y: hy, width: hw, height: hh };
  }

  // Coloca o balão onde houver mais espaço (abaixo do furo, de preferência).
  const belowSpace = hole ? height - (hole.y + hole.height) : 0;
  const aboveSpace = hole ? hole.y : 0;
  const placeBelow = hole ? belowSpace >= 230 || belowSpace >= aboveSpace : false;

  // Entrada suave a cada passo.
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [index, anim]);

  // Anel pulsante ao redor do furo, para o olhar encontrar o destaque.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 0.3] });

  const cardEnter = {
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }]
  };

  const caretLeft = hole ? Math.min(Math.max(hole.x + hole.width / 2 - 16 - 10, 20), width - 32 - 40) : 0;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {/* Fundo escurecido com o furo do spotlight (ou tela cheia se centralizado). */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Mask id="coach-hole">
            <Rect x={0} y={0} width={width} height={height} fill="#fff" />
            {hole ? (
              <Rect x={hole.x} y={hole.y} width={hole.width} height={hole.height} rx={corner} ry={corner} fill="#000" />
            ) : null}
          </Mask>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="#160c05" fillOpacity={0.76} mask="url(#coach-hole)" />
      </Svg>

      {/* Camada que segura os toques (impede tocar no app durante o passeio). */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => undefined} />

      {/* Anel pulsante ao redor do furo. */}
      {hole ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: hole.x,
            top: hole.y,
            width: hole.width,
            height: hole.height,
            borderRadius: corner,
            borderWidth: 3,
            borderColor: colors.brand,
            opacity: ringOpacity
          }}
        />
      ) : null}

      {/* Balão de texto: centralizado ou junto ao furo. */}
      <View
        style={[
          styles.cardWrap,
          centered
            ? styles.cardWrapCentered
            : placeBelow
              ? { top: (hole?.y ?? 0) + (hole?.height ?? 0) + 16 }
              : { bottom: height - (hole?.y ?? 0) + 16 }
        ]}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.card, shadows.floating, cardEnter]}>
          {/* Bico apontando para o furo. */}
          {!centered ? (
            <View style={[styles.caret, placeBelow ? styles.caretUp : styles.caretDown, { left: caretLeft }]} />
          ) : null}

          <View style={styles.cardHeader}>
            {step.emoji ? (
              <View style={styles.emojiCircle}>
                <Text style={styles.emoji}>{step.emoji}</Text>
              </View>
            ) : null}
            <Text style={[styles.title, { fontSize: 20 * scale }]}>{step.title}</Text>
          </View>

          <Text style={[styles.body, { fontSize: 15.5 * scale }]}>{step.body}</Text>

          <View style={styles.dots}>
            {Array.from({ length: total }).map((_, dotIndex) => (
              <View key={dotIndex} style={[styles.dot, dotIndex === index && styles.dotActive]} />
            ))}
          </View>

          <View style={styles.actions}>
            <Pressable onPress={onSkip} hitSlop={8} style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}>
              <Text style={styles.skipText}>Pular</Text>
            </Pressable>
            <View style={styles.actionsRight}>
              {index > 0 && !isLast ? (
                <Pressable onPress={onBack} hitSlop={8} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
                  <Text style={styles.backText}>Voltar</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={onNext} style={({ pressed }) => [styles.nextButton, pressed && styles.pressed]}>
                <Text style={styles.nextText}>{isLast ? "Entendi!" : "Próximo"}</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

// Envolve um elemento que o tour pode destacar. Um View leve com collapsable
// desligado, para o measureInWindow funcionar também no Android.
export function CoachAnchor({
  name,
  children,
  style
}: {
  name: string;
  children: ReactNode;
  style?: object;
}) {
  const { registerTarget } = useCoach();
  const setRef = useCallback((node: View | null) => registerTarget(name, node), [name, registerTarget]);
  return (
    <View ref={setRef} collapsable={false} style={style}>
      {children}
    </View>
  );
}

export function useCoach() {
  const context = useContext(CoachContext);
  if (!context) throw new Error("useCoach precisa estar dentro de CoachProvider.");
  return context;
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92
  },
  cardWrap: {
    position: "absolute",
    left: 16,
    right: 16
  },
  cardWrapCentered: {
    top: 0,
    bottom: 0,
    justifyContent: "center"
  },
  card: {
    gap: 12,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18
  },
  caret: {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent"
  },
  caretUp: {
    top: -10,
    borderBottomWidth: 10,
    borderBottomColor: colors.surface
  },
  caretDown: {
    bottom: -10,
    borderTopWidth: 10,
    borderTopColor: colors.surface
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  emojiCircle: {
    height: 46,
    width: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft
  },
  emoji: {
    fontSize: 24
  },
  title: {
    flex: 1,
    color: colors.ink,
    fontSize: 20,
    fontFamily: fonts.display,
    letterSpacing: -0.3
  },
  body: {
    color: colors.ink,
    fontSize: 15.5,
    lineHeight: 23,
    fontFamily: fonts.body
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 2
  },
  dot: {
    height: 7,
    width: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.border
  },
  dotActive: {
    width: 20,
    backgroundColor: colors.brand
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  actionsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  skipButton: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 8
  },
  skipText: {
    color: colors.muted,
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  backButton: {
    minHeight: 48,
    justifyContent: "center",
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    backgroundColor: colors.surfaceWarm
  },
  backText: {
    color: colors.ink,
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  nextButton: {
    minHeight: 48,
    justifyContent: "center",
    borderRadius: radius.pill,
    paddingHorizontal: 24,
    backgroundColor: colors.brandDeep,
    ...shadows.brand
  },
  nextText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: fonts.bodyBold
  }
});
