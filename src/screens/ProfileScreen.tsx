import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Camera, Images, KeyRound, LogIn, LogOut, Mail, UserRound } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { Badge, Button, Card, Field, Input, Page, Sheet, StateText } from "@/components/ui";
import { AUTH_REQUIRED } from "@/constants/auth";
import { useAuth } from "@/contexts/auth";
import { api, ApiError } from "@/lib/api";
import { emptyProfile, readProfile, saveProfile, type LocalProfile } from "@/lib/profile";
import { apiUrls, getBaseUrl, readApiSettings, saveApiSettings, type ApiSettings } from "@/lib/settings";
import { colors, fonts, radius, shadows } from "@/lib/theme";
import { getGreeting } from "@/utils/greeting";
import { pickImage } from "@/utils/media";
import type { ApiEnvironment } from "@/types/api";

type ActiveSheet = "password" | "email" | null;

// Perfil substitui a antiga tela Ajustes: dados da pessoa, conta e
// segurança, e a conexão com o servidor no fim.
export function ProfileScreen() {
  const router = useRouter();
  const { status, user, signOut } = useAuth();
  const [sheet, setSheet] = useState<ActiveSheet>(null);

  // Dados pessoais guardados no aparelho (backend de perfil ainda não existe).
  const [profile, setProfile] = useState<LocalProfile>(emptyProfile);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    readProfile()
      .then(setProfile)
      .catch(() => undefined)
      .finally(() => setProfileLoaded(true));
  }, []);

  const saveData = useMutation({
    mutationFn: () => saveProfile(profile)
  });

  async function choosePhoto(source: "camera" | "gallery") {
    try {
      setPhotoError(null);
      const file = await pickImage(source, "perfil");
      if (!file) return;
      const next = { ...profile, fotoUri: file.uri };
      setProfile(next);
      await saveProfile(next);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Não foi possível escolher a foto.");
    }
  }

  function confirmSignOut() {
    const doSignOut = () => void signOut();
    if (Platform.OS === "web") {
      const webConfirm = (globalThis as { confirm?: (text: string) => boolean }).confirm;
      if (!webConfirm || webConfirm("Sair da conta?")) doSignOut();
      return;
    }
    Alert.alert("Sair da conta", "Você vai precisar entrar de novo para usar a conta.", [
      { text: "Voltar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: doSignOut }
    ]);
  }

  return (
    <>
      <Page greeting={getGreeting()} title="Perfil" subtitle="Seus dados, sua conta e a conexão do app.">
        {/* Foto e dados pessoais */}
        <Card>
          <View style={styles.header}>
            <ProfilePhoto uri={profile.fotoUri} />
            <View style={styles.headerInfo}>
              <Text style={styles.headerName}>{profile.nome.trim() || "Seu nome"}</Text>
              {user ? <Badge text={`@${user.usuario}`} tone="good" /> : <Badge text="Conta não conectada" tone="neutral" />}
            </View>
          </View>

          <View style={styles.photoActions}>
            <PhotoAction icon={<Camera size={18} color={colors.brandDeep} />} label="Fotografar" onPress={() => choosePhoto("camera")} />
            <PhotoAction icon={<Images size={18} color={colors.brandDeep} />} label="Galeria" onPress={() => choosePhoto("gallery")} />
          </View>
          {photoError ? <StateText tone="error" text={photoError} /> : null}

          <Field label="Nome">
            <Input value={profile.nome} onChangeText={(nome) => setProfile({ ...profile, nome })} placeholder="Como você quer ser chamado" />
          </Field>
          <Field label="Data de nascimento">
            <Input
              value={profile.nascimento}
              onChangeText={(nascimento) => setProfile({ ...profile, nascimento })}
              placeholder="DD/MM/AAAA"
              keyboardType="numbers-and-punctuation"
            />
          </Field>
          <Field label="Telefone">
            <Input
              value={profile.telefone}
              onChangeText={(telefone) => setProfile({ ...profile, telefone })}
              placeholder="(00) 00000-0000"
              keyboardType="phone-pad"
            />
          </Field>
          <Field label="E-mail">
            <Input
              value={profile.email}
              onChangeText={(email) => setProfile({ ...profile, email })}
              placeholder="seu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </Field>

          {saveData.isSuccess ? <StateText tone="success" text="Dados salvos neste aparelho." /> : null}
          {saveData.error instanceof Error ? <StateText tone="error" text={saveData.error.message} /> : null}
          <Button
            title={saveData.isPending ? "Salvando..." : "Salvar dados"}
            disabled={!profileLoaded || saveData.isPending}
            onPress={() => saveData.mutate()}
          />
        </Card>

        {/* Conta e segurança */}
        <Card>
          <Text style={styles.sectionTitle}>Conta e segurança</Text>

          {status === "signed-in" && user ? (
            <>
              <InfoRow icon={<UserRound size={18} color={colors.brandDeep} />} label="Usuário" value={user.usuario} />
              <InfoRow icon={<Mail size={18} color={colors.brandDeep} />} label="E-mail de acesso" value={user.email || "não informado"} />
              <Button
                title="Alterar senha"
                tone="soft"
                icon={<KeyRound size={18} color={colors.ink} />}
                onPress={() => setSheet("password")}
              />
              <Button
                title="Alterar e-mail"
                tone="soft"
                icon={<Mail size={18} color={colors.ink} />}
                onPress={() => setSheet("email")}
              />
              <Button title="Sair da conta" tone="danger" icon={<LogOut size={18} color="#fff" />} onPress={confirmSignOut} />
            </>
          ) : (
            <>
              <Text style={styles.muted}>
                {AUTH_REQUIRED
                  ? "Sua sessão terminou. Entre de novo para continuar."
                  : "Você ainda não entrou com uma conta. O login protege seus dados quando o servidor estiver pronto."}
              </Text>
              <Button
                title="Fazer login"
                icon={<LogIn size={18} color="#fff" />}
                onPress={() => router.push("/login")}
              />
            </>
          )}
        </Card>

        {/* Conexão com o servidor (antiga tela Ajustes) */}
        <ConnectionCard />
      </Page>

      <ChangePasswordSheet visible={sheet === "password"} onClose={() => setSheet(null)} />
      <ChangeEmailSheet visible={sheet === "email"} onClose={() => setSheet(null)} />
    </>
  );
}

function ProfilePhoto({ uri }: { uri: string | null }) {
  if (!uri) {
    return (
      <View style={styles.avatarFallback}>
        <UserRound size={34} color={colors.brandDeep} />
      </View>
    );
  }
  return <Image source={{ uri }} style={styles.avatar} contentFit="cover" transition={180} />;
}

function PhotoAction({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.photoAction, pressed && styles.pressed]}>
      {icon}
      <Text style={styles.photoActionText}>{label}</Text>
    </Pressable>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>{icon}</View>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

// Troca de senha com confirmação; erros do servidor em linguagem humana.
function ChangePasswordSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [validation, setValidation] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: () => api.auth.changePassword({ senha_atual: current, senha_nova: next }),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirm("");
      onClose();
    }
  });

  function submit() {
    if (next.length < 6) {
      setValidation("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (next !== confirm) {
      setValidation("A confirmação não bate com a nova senha.");
      return;
    }
    setValidation(null);
    change.mutate();
  }

  return (
    <Sheet visible={visible} title="Alterar senha" subtitle="Escolha uma senha fácil de lembrar e difícil de adivinhar." onClose={onClose}>
      <Field label="Senha atual">
        <Input value={current} onChangeText={setCurrent} secureTextEntry />
      </Field>
      <Field label="Nova senha">
        <Input value={next} onChangeText={setNext} secureTextEntry />
      </Field>
      <Field label="Confirmar nova senha">
        <Input value={confirm} onChangeText={setConfirm} secureTextEntry />
      </Field>
      {validation ? <StateText tone="error" text={validation} /> : null}
      {change.error ? <StateText tone="error" text={securityErrorMessage(change.error)} /> : null}
      <Button
        title={change.isPending ? "Salvando..." : "Salvar nova senha"}
        disabled={!current || !next || !confirm || change.isPending}
        onPress={submit}
      />
    </Sheet>
  );
}

function ChangeEmailSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const change = useMutation({
    mutationFn: () => api.auth.changeEmail({ email: email.trim(), senha }),
    onSuccess: () => {
      setEmail("");
      setSenha("");
      onClose();
    }
  });

  return (
    <Sheet visible={visible} title="Alterar e-mail" subtitle="Confirme com a sua senha." onClose={onClose}>
      <Field label="Novo e-mail">
        <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="novo@email.com" />
      </Field>
      <Field label="Senha">
        <Input value={senha} onChangeText={setSenha} secureTextEntry />
      </Field>
      {change.error ? <StateText tone="error" text={securityErrorMessage(change.error)} /> : null}
      <Button
        title={change.isPending ? "Salvando..." : "Salvar novo e-mail"}
        disabled={!email.trim() || !senha || change.isPending}
        onPress={() => change.mutate()}
      />
    </Sheet>
  );
}

function securityErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if ([401, 403].includes(error.status)) return "Senha atual incorreta.";
    if ([404, 405, 501].includes(error.status)) {
      return "O servidor ainda não tem esse recurso. Essa parte do sistema está em construção.";
    }
  }
  return error instanceof Error ? error.message : "Não foi possível salvar.";
}

// Ambiente, API key e teste de conexão: conteúdo herdado da tela Ajustes.
function ConnectionCard() {
  const [settings, setSettings] = useState<ApiSettings>({ environment: "production", apiKey: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    readApiSettings().then(setSettings).catch(() => undefined);
  }, []);

  const save = useMutation({
    mutationFn: () => saveApiSettings(settings),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    }
  });
  const health = useMutation({
    mutationFn: () => api.health(settings)
  });

  function setEnvironment(environment: ApiEnvironment) {
    setSettings((currentSettings) => ({ ...currentSettings, environment }));
  }

  return (
    <Card>
      <Text style={styles.sectionTitle}>Conexão com o servidor</Text>
      <View style={styles.segment}>
        <SegmentButton
          label="Railway"
          active={settings.environment === "production"}
          onPress={() => setEnvironment("production")}
        />
        <SegmentButton label="Local" active={settings.environment === "local"} onPress={() => setEnvironment("local")} />
      </View>
      <Text style={styles.muted}>Backend atual: {getBaseUrl(settings.environment)}</Text>
      <Text style={styles.hint}>Local no celular geralmente precisa ser o IP da máquina na rede, não localhost.</Text>

      <Field label="API key">
        <Input value={settings.apiKey} onChangeText={(apiKey) => setSettings({ ...settings, apiKey })} secureTextEntry />
      </Field>
      <Button title={save.isPending ? "Salvando..." : "Salvar conexão"} tone="soft" disabled={save.isPending} onPress={() => save.mutate()} />
      {saved ? <StateText tone="success" text="Conexão salva neste dispositivo." /> : null}
      {save.error instanceof Error ? <StateText tone="error" text={save.error.message} /> : null}

      <Button
        title={health.isPending ? "Testando..." : "Testar conexão"}
        tone="outline"
        disabled={health.isPending}
        onPress={() => health.mutate()}
      />
      {health.data ? <StateText tone="success" text={`Conectado: ${health.data.status || "ok"}`} /> : null}
      {health.error instanceof Error ? <StateText tone="error" text={health.error.message} /> : null}

      <Text style={styles.muted}>Produção: {apiUrls.production}</Text>
      <Text style={styles.muted}>Local: {apiUrls.local}</Text>
    </Card>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.segmentButton, active && styles.segmentButtonActive]}>
      <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.8
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  headerInfo: {
    flex: 1,
    gap: 6
  },
  headerName: {
    color: colors.ink,
    fontSize: 22,
    fontFamily: fonts.display,
    letterSpacing: -0.3
  },
  avatar: {
    height: 84,
    width: 84,
    borderRadius: 42,
    backgroundColor: colors.surfaceWarm
  },
  avatarFallback: {
    height: 84,
    width: 84,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 42,
    backgroundColor: colors.brandSoft
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
    minHeight: 48,
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
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontFamily: fonts.display
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  infoIcon: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft
  },
  infoText: {
    flex: 1
  },
  infoLabel: {
    color: colors.muted,
    fontSize: 12,
    fontFamily: fonts.bodyBold
  },
  infoValue: {
    color: colors.ink,
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  muted: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.body
  },
  hint: {
    color: colors.warning,
    fontSize: 13,
    fontFamily: fonts.body
  },
  segment: {
    flexDirection: "row",
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm,
    padding: 5
  },
  segmentButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    paddingVertical: 11
  },
  segmentButtonActive: {
    backgroundColor: colors.brand,
    ...shadows.brand
  },
  segmentLabel: {
    color: colors.muted,
    fontFamily: fonts.bodyBold
  },
  segmentLabelActive: {
    color: "#fff"
  }
});
