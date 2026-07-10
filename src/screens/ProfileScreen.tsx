import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Camera, Images, KeyRound, LogIn, LogOut, Mail, ShieldCheck, UserRound } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { ApiLogPanel } from "@/components/api-log-panel";
import { Badge, Button, Card, Field, Input, Page, Sheet, StateText } from "@/components/ui";
import { AUTH_REQUIRED } from "@/constants/auth";
import { useAuth } from "@/contexts/auth";
import { api, ApiError } from "@/lib/api";
import { emptyProfile, readProfile, saveProfile, type LocalProfile } from "@/lib/profile";
import { colors, fonts, radius } from "@/lib/theme";
import { pickImage } from "@/utils/media";

type ActiveSheet = "password" | "email" | null;

const PAPEL_LABEL: Record<string, string> = {
  dono: "Dono",
  administrador: "Administrador",
  usuario: "Usuário"
};

// Perfil substitui a antiga tela Ajustes: dados da pessoa, conta e
// segurança, e a conexão com o servidor no fim. Quando logado, os dados
// pessoais sincronizam com o servidor; senão, ficam no aparelho.
export function ProfileScreen() {
  const router = useRouter();
  const { status, user, signOut, setUser } = useAuth();
  const [sheet, setSheet] = useState<ActiveSheet>(null);

  const [profile, setProfile] = useState<LocalProfile>(emptyProfile);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Carrega os dados locais e, se logado, mescla o que veio do servidor.
  useEffect(() => {
    readProfile()
      .then((local) => {
        setProfile({
          ...local,
          nome: user?.nome || local.nome,
          telefone: user?.telefone || local.telefone,
          email: user?.email || local.email,
          nascimento: user?.data_nascimento || local.nascimento,
          fotoUri: local.fotoUri || user?.foto_url || null
        });
      })
      .catch(() => undefined)
      .finally(() => setProfileLoaded(true));
  }, [user]);

  const saveData = useMutation({
    mutationFn: async () => {
      await saveProfile(profile);
      // Logado: espelha os campos textuais no servidor.
      if (status === "signed-in") {
        const updated = await api.auth.updateProfile({
          nome: profile.nome || null,
          telefone: profile.telefone || null,
          data_nascimento: profile.nascimento || null,
          email: profile.email || null
        });
        setUser(updated);
      }
    }
  });

  async function choosePhoto(source: "camera" | "gallery") {
    try {
      setPhotoError(null);
      const file = await pickImage(source, "perfil");
      if (!file) return;
      // Mostra a foto do aparelho na hora; sobe pro servidor se estiver logado.
      const next = { ...profile, fotoUri: file.uri };
      setProfile(next);
      await saveProfile(next);

      if (status === "signed-in") {
        setPhotoUploading(true);
        const form = new FormData();
        form.append("file", file as unknown as Blob);
        const updated = await api.auth.uploadPhoto(form);
        setUser(updated);
        if (updated.foto_url) {
          const synced = { ...next, fotoUri: updated.foto_url };
          setProfile(synced);
          await saveProfile(synced);
        }
      }
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Não foi possível salvar a foto.");
    } finally {
      setPhotoUploading(false);
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

  const papel = user?.papel ? PAPEL_LABEL[user.papel] || user.papel : null;

  return (
    <>
      <Page title="Perfil" subtitle="Seus dados e sua conta.">
        {/* Foto e dados pessoais */}
        <Card>
          <View style={styles.header}>
            <ProfilePhoto uri={profile.fotoUri} />
            <View style={styles.headerInfo}>
              <Text style={styles.headerName}>{profile.nome.trim() || "Seu nome"}</Text>
              {user ? (
                <View style={styles.headerBadges}>
                  <Badge text={user.email} tone="good" />
                  {papel ? <Badge text={papel} tone="agent" /> : null}
                </View>
              ) : (
                <Badge text="Conta não conectada" tone="neutral" />
              )}
            </View>
          </View>

          <View style={styles.photoActions}>
            <PhotoAction icon={<Camera size={18} color={colors.brandDeep} />} label="Fotografar" onPress={() => choosePhoto("camera")} />
            <PhotoAction icon={<Images size={18} color={colors.brandDeep} />} label="Galeria" onPress={() => choosePhoto("gallery")} />
          </View>
          {photoUploading ? <StateText text="Enviando foto..." /> : null}
          {photoError ? <StateText tone="error" text={photoError} /> : null}

          <Field label="Nome">
            <Input
              value={profile.nome}
              onChangeText={(nome) => setProfile({ ...profile, nome })}
              placeholder="Como você quer ser chamado"
              maxLength={60}
            />
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

          {saveData.isSuccess ? (
            <StateText tone="success" text={status === "signed-in" ? "Dados salvos na sua conta." : "Dados salvos neste aparelho."} />
          ) : null}
          {saveData.error ? <StateText tone="error" text={profileErrorMessage(saveData.error)} /> : null}
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
              <InfoRow icon={<UserRound size={18} color={colors.brandDeep} />} label="Nome" value={user.nome || "não informado"} />
              <InfoRow icon={<Mail size={18} color={colors.brandDeep} />} label="E-mail de acesso" value={user.email} />
              {papel ? (
                <InfoRow icon={<ShieldCheck size={18} color={colors.brandDeep} />} label="Papel" value={papel} />
              ) : null}
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
                  : "Entre com uma conta para análises com IA, gestão de custos e para proteger seus dados."}
              </Text>
              <Button
                title="Entrar ou criar conta"
                icon={<LogIn size={18} color="#fff" />}
                onPress={() => router.push("/login")}
              />
            </>
          )}
        </Card>

        {/* Diagnóstico: histórico de chamadas ao servidor (ajuda a investigar erros). */}
        <ApiLogPanel />
      </Page>

      <ChangePasswordSheet visible={sheet === "password"} onClose={() => setSheet(null)} />
      <ChangeEmailSheet
        visible={sheet === "email"}
        currentEmail={user?.email || ""}
        onClose={() => setSheet(null)}
        onChanged={(updatedEmail) => {
          if (user) setUser({ ...user, email: updatedEmail });
        }}
      />
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
    mutationFn: () => api.auth.changePassword({ senha_atual: current, nova_senha: next }),
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
      {change.isSuccess ? <StateText tone="success" text="Senha alterada!" /> : null}
      {change.error ? <StateText tone="error" text={securityErrorMessage(change.error)} /> : null}
      <Button
        title={change.isPending ? "Salvando..." : "Salvar nova senha"}
        disabled={!current || !next || !confirm || change.isPending}
        onPress={submit}
      />
    </Sheet>
  );
}

// Troca de e-mail via atualização de perfil.
function ChangeEmailSheet({
  visible,
  currentEmail,
  onClose,
  onChanged
}: {
  visible: boolean;
  currentEmail: string;
  onClose: () => void;
  onChanged: (email: string) => void;
}) {
  const [email, setEmail] = useState("");

  const change = useMutation({
    mutationFn: () => api.auth.updateProfile({ email: email.trim() }),
    onSuccess: (updated) => {
      onChanged(updated.email || email.trim());
      setEmail("");
      onClose();
    }
  });

  return (
    <Sheet visible={visible} title="Alterar e-mail" subtitle={currentEmail ? `Atual: ${currentEmail}` : undefined} onClose={onClose}>
      <Field label="Novo e-mail">
        <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="novo@email.com" />
      </Field>
      {change.error ? <StateText tone="error" text={securityErrorMessage(change.error)} /> : null}
      <Button
        title={change.isPending ? "Salvando..." : "Salvar novo e-mail"}
        disabled={!email.trim() || change.isPending}
        onPress={() => change.mutate()}
      />
    </Sheet>
  );
}

function securityErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if ([401, 403].includes(error.status)) return "Senha atual incorreta ou sessão expirada.";
    if (error.status === 409) return "Já existe uma conta com esse e-mail.";
    if (error.status === 422) return "Confira os dados informados.";
  }
  return error instanceof Error ? error.message : "Não foi possível salvar.";
}

function profileErrorMessage(error: unknown) {
  if (error instanceof ApiError && [401, 403].includes(error.status)) {
    return "Sua sessão expirou. Entre de novo para salvar na conta.";
  }
  return error instanceof Error ? error.message : "Não foi possível salvar.";
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
  headerBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
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
  }
});
