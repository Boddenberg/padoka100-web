import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  CalendarDays,
  Camera,
  Images,
  KeyRound,
  LogIn,
  LogOut,
  Mail,
  Pencil,
  Phone,
  UserRound
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { ApiLogPanel } from "@/components/api-log-panel";
import { IaMediaPanel } from "@/components/ia-media-panel";
import { PlansShowcase } from "@/components/plans-showcase";
import { Badge, Button, Card, Field, Input, Page, Sheet, StateText } from "@/components/ui";
import { AUTH_REQUIRED } from "@/constants/auth";
import { useAuth } from "@/contexts/auth";
import { planLabel } from "@/lib/access";
import { api, ApiError } from "@/lib/api";
import { brDateToIso, maskBrDate, toBrDate } from "@/lib/format";
import { formatBrazilianPhone, isValidBrazilianPhone, PHONE_ERROR } from "@/lib/phone";
import { emptyProfile, readProfile, saveProfile, type LocalProfile } from "@/lib/profile";
import { colors, fonts, radius } from "@/lib/theme";
import type { UsuarioPerfil } from "@/types/api";
import { pickImage } from "@/utils/media";

type ActiveSheet = "personal" | "password" | null;

const PAPEL_LABEL: Record<string, string> = {
  dono: "Dono",
  administrador: "Administrador",
  usuario: "Usuário"
};

// Perfil em modo leitura: os dados pessoais aparecem como informação, e o
// lápis abre a edição num sheet. Quando logado, os dados sincronizam com o
// servidor; senão, ficam no aparelho. A vitrine de planos vem na sequência.
export function ProfileScreen() {
  const router = useRouter();
  const { status, user, signOut, setUser } = useAuth();
  const [sheet, setSheet] = useState<ActiveSheet>(null);

  const [profile, setProfile] = useState<LocalProfile>(emptyProfile);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Carrega os dados locais e, se logado, mescla o que veio do servidor,
  // já normalizando telefone e nascimento para o formato de exibição.
  useEffect(() => {
    readProfile()
      .then((local) => {
        setProfile({
          ...local,
          nome: user?.nome || local.nome,
          telefone: formatBrazilianPhone(user?.telefone || local.telefone),
          email: user?.email || local.email,
          nascimento: toBrDate(user?.data_nascimento || local.nascimento),
          fotoUri: local.fotoUri || user?.foto_url || null
        });
      })
      .catch(() => undefined)
      .finally(() => setProfileLoaded(true));
  }, [user]);

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
  const plano = user ? planLabel(user) : null;

  return (
    <>
      <Page title="Perfil" subtitle="Seus dados e sua conta.">
        {/* Foto e dados pessoais (somente leitura; o lápis edita) */}
        <Card>
          <View style={styles.header}>
            <ProfilePhoto uri={profile.fotoUri} />
            <View style={styles.headerInfo}>
              <Text style={styles.headerName}>{profile.nome.trim() || "Seu nome"}</Text>
              {user ? (
                <View style={styles.headerBadges}>
                  {plano ? <Badge text={`Plano ${plano}`} tone="agent" /> : null}
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

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Dados pessoais</Text>
            <Pressable
              accessibilityLabel="Editar dados pessoais"
              disabled={!profileLoaded}
              onPress={() => {
                setSavedMessage(null);
                setSheet("personal");
              }}
              style={({ pressed }) => [styles.editButton, pressed && styles.pressed, !profileLoaded && styles.pressed]}
            >
              <Pencil size={18} color={colors.brandDeep} />
            </Pressable>
          </View>

          <InfoRow icon={<UserRound size={18} color={colors.brandDeep} />} label="Nome" value={profile.nome.trim() || "Não informado"} />
          <InfoRow
            icon={<CalendarDays size={18} color={colors.brandDeep} />}
            label="Data de nascimento"
            value={profile.nascimento.trim() || "Não informada"}
          />
          <InfoRow icon={<Phone size={18} color={colors.brandDeep} />} label="Telefone" value={profile.telefone.trim() || "Não informado"} />
          <InfoRow icon={<Mail size={18} color={colors.brandDeep} />} label="E-mail" value={profile.email.trim() || "Não informado"} />

          {savedMessage ? <StateText tone="success" text={savedMessage} /> : null}
        </Card>

        {/* Planos: aparece logado (menos admin, que não faz upgrade). */}
        {status === "signed-in" && user ? <PlansShowcase user={user} /> : null}

        {/* Conta e segurança: só ações — os dados moram em "Dados pessoais". */}
        <Card>
          <Text style={styles.sectionTitle}>Conta e segurança</Text>

          {status === "signed-in" && user ? (
            <>
              <Button
                title="Alterar senha"
                tone="soft"
                icon={<KeyRound size={18} color={colors.ink} />}
                onPress={() => setSheet("password")}
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

        {/* Rastreio admin: áudios/fotos que os clientes enviaram para a IA. */}
        <IaMediaPanel />
      </Page>

      <EditPersonalSheet
        visible={sheet === "personal"}
        profile={profile}
        signedIn={status === "signed-in"}
        onClose={() => setSheet(null)}
        onSaved={(next, updated) => {
          setProfile(next);
          if (updated) setUser(updated);
          setSavedMessage(updated ? "Dados salvos na sua conta." : "Dados salvos neste aparelho.");
        }}
      />
      <ChangePasswordSheet visible={sheet === "password"} onClose={() => setSheet(null)} />
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

// Edição dos dados pessoais num sheet: valida telefone e nascimento antes de
// salvar. Logado, espelha no servidor (nascimento vai em ISO, como a API pede).
function EditPersonalSheet({
  visible,
  profile,
  signedIn,
  onClose,
  onSaved
}: {
  visible: boolean;
  profile: LocalProfile;
  signedIn: boolean;
  onClose: () => void;
  onSaved: (next: LocalProfile, updated: UsuarioPerfil | null) => void;
}) {
  const [draft, setDraft] = useState<LocalProfile>(profile);
  const [validation, setValidation] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const next: LocalProfile = {
        ...draft,
        nome: draft.nome.trim(),
        email: draft.email.trim(),
        telefone: formatBrazilianPhone(draft.telefone),
        nascimento: draft.nascimento.trim()
      };
      await saveProfile(next);
      if (signedIn) {
        const updated = await api.auth.updateProfile({
          nome: next.nome || null,
          telefone: next.telefone || null,
          data_nascimento: next.nascimento ? brDateToIso(next.nascimento) : null,
          email: next.email || null
        });
        return { next, updated };
      }
      return { next, updated: null };
    },
    onSuccess: ({ next, updated }) => {
      onSaved(next, updated);
      onClose();
    }
  });
  const resetSave = save.reset;

  // Cada abertura parte do que está salvo, sem sobras da edição anterior.
  useEffect(() => {
    if (visible) {
      setDraft(profile);
      setValidation(null);
      resetSave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function submit() {
    if (draft.telefone.trim() && !isValidBrazilianPhone(draft.telefone)) {
      setValidation(PHONE_ERROR);
      return;
    }
    if (draft.nascimento.trim() && !brDateToIso(draft.nascimento.trim())) {
      setValidation("Data de nascimento inválida. Use o formato DD/MM/AAAA.");
      return;
    }
    if (draft.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email.trim())) {
      setValidation("E-mail inválido. Confira e tente de novo.");
      return;
    }
    setValidation(null);
    save.mutate();
  }

  return (
    <Sheet visible={visible} title="Editar dados pessoais" subtitle="Mude o que precisar e salve." onClose={onClose}>
      <Field label="Nome">
        <Input
          value={draft.nome}
          onChangeText={(nome) => setDraft({ ...draft, nome })}
          placeholder="Como você quer ser chamado"
          maxLength={60}
        />
      </Field>
      <Field label="Data de nascimento">
        <Input
          value={draft.nascimento}
          onChangeText={(nascimento) => setDraft({ ...draft, nascimento: maskBrDate(nascimento) })}
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          maxLength={10}
        />
      </Field>
      <Field label="Telefone">
        <Input
          value={draft.telefone}
          onChangeText={(telefone) => setDraft({ ...draft, telefone: formatBrazilianPhone(telefone) })}
          placeholder="(11) 98765-4321"
          keyboardType="phone-pad"
          maxLength={16}
        />
      </Field>
      <Field label="E-mail">
        <Input
          value={draft.email}
          onChangeText={(email) => setDraft({ ...draft, email })}
          placeholder="seu@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </Field>
      {validation ? <StateText tone="error" text={validation} /> : null}
      {save.error ? <StateText tone="error" text={profileErrorMessage(save.error)} /> : null}
      <Button title={save.isPending ? "Salvando..." : "Salvar dados"} disabled={save.isPending} onPress={submit} />
    </Sheet>
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

function securityErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if ([401, 403].includes(error.status)) return "Senha atual incorreta ou sessão expirada.";
    if (error.status === 409) return "Já existe uma conta com esse e-mail.";
    if (error.status === 422) return "Confira os dados informados.";
  }
  return error instanceof Error ? error.message : "Não foi possível salvar.";
}

function profileErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if ([401, 403].includes(error.status)) return "Sua sessão expirou. Entre de novo para salvar na conta.";
    if (error.status === 409) return "Já existe uma conta com esse e-mail.";
    if (error.status === 422) return "Confira os dados informados.";
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontFamily: fonts.display
  },
  editButton: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.brandSoft,
    backgroundColor: colors.surfaceGlow
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
