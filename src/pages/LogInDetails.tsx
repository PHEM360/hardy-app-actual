import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Fingerprint,
  Globe,
  KeyRound,
  Lock,
  LockKeyhole,
  Pencil,
  Phone,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  Trash2,
  User,
  X,
} from "lucide-react";
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import PasswordVaultGate from "@/components/passwords/PasswordVaultGate";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useSharedScope } from "@/hooks/useSharedScope";
import { usePageShares, type SharePermission } from "@/hooks/usePageShares";
import { useAppUsers } from "@/hooks/useAppUsers";
import {
  decryptCredential,
  encryptCredential,
  encryptCredentialWithItemKey,
  importPrivateKey,
  wrapCredentialKey,
  type CredentialField,
  type CredentialFieldType,
  type PasswordVaultConfig,
  type PlainCredential,
  type VaultCipher,
  type VaultPublicKey,
} from "@/lib/passwordVaultCrypto";
import { toast } from "sonner";

interface IndividualShare {
  uid: string;
  permission: SharePermission;
}

interface EncryptedCredentialDoc {
  id: string;
  ownerId: string;
  encrypted?: boolean;
  cipher?: VaultCipher;
  wrappedKeys?: Record<string, string>;
  sharedWith?: string[];
  editors?: string[];
  individualShares?: IndividualShare[];
  individualAccess?: string[];
  individualEditors?: string[];
  legacy?: Partial<PlainCredential>;
}

interface VaultCredential extends PlainCredential {
  id: string;
  ownerId: string;
  itemKey: Uint8Array;
  wrappedKeys: Record<string, string>;
  sharedWith: string[];
  editors: string[];
  individualShares: IndividualShare[];
  individualAccess: string[];
  individualEditors: string[];
}

const EMPTY: PlainCredential = {
  name: "",
  url: "",
  username: "",
  email: "",
  password: "",
  fields: [],
  notes: "",
  category: "",
};

const FIELD_OPTIONS: { type: CredentialFieldType; label: string }[] = [
  { type: "username", label: "Username" },
  { type: "email", label: "Email address" },
  { type: "userId", label: "User ID" },
  { type: "password", label: "Password" },
  { type: "website", label: "Website" },
  { type: "phone", label: "Phone number" },
  { type: "accountNumber", label: "Account number" },
  { type: "membershipNumber", label: "Membership number" },
  { type: "pin", label: "PIN or security code" },
  { type: "other", label: "Other…" },
];

function newField(type: CredentialFieldType, label?: string): CredentialField {
  return {
    id: crypto.randomUUID(),
    type,
    label: label || FIELD_OPTIONS.find((option) => option.type === type)?.label || "Other",
    value: "",
  };
}

function credentialFields(credential: PlainCredential): CredentialField[] {
  if (Array.isArray(credential.fields)) return credential.fields;
  return [
    credential.url ? { id: "legacy-url", type: "website" as const, label: "Website", value: credential.url } : null,
    credential.email ? { id: "legacy-email", type: "email" as const, label: "Email address", value: credential.email } : null,
    credential.username ? { id: "legacy-username", type: "username" as const, label: "Username", value: credential.username } : null,
    credential.password ? { id: "legacy-password", type: "password" as const, label: "Password", value: credential.password } : null,
  ].filter(Boolean) as CredentialField[];
}

function secretField(type: CredentialFieldType) {
  return type === "password" || type === "pin";
}

function fieldIcon(type: CredentialFieldType): ReactNode {
  if (type === "website") return <Globe className="h-3.5 w-3.5" />;
  if (type === "email") return <span className="text-xs font-bold">@</span>;
  if (type === "phone") return <Phone className="h-3.5 w-3.5" />;
  if (secretField(type)) return <Lock className="h-3.5 w-3.5" />;
  return <User className="h-3.5 w-3.5" />;
}

const CATEGORIES = ["Banking", "Email", "Shopping", "Work", "Social", "Finance", "Health", "Government", "Other"];
const CAT_STYLES: Record<string, { border: string; avatar: string; text: string }> = {
  Banking: { border: "border-l-blue-400", avatar: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300" },
  Email: { border: "border-l-emerald-400", avatar: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300" },
  Shopping: { border: "border-l-orange-400", avatar: "bg-orange-100 dark:bg-orange-900/40", text: "text-orange-700 dark:text-orange-300" },
  Work: { border: "border-l-violet-400", avatar: "bg-violet-100 dark:bg-violet-900/40", text: "text-violet-700 dark:text-violet-300" },
  Social: { border: "border-l-pink-400", avatar: "bg-pink-100 dark:bg-pink-900/40", text: "text-pink-700 dark:text-pink-300" },
  Finance: { border: "border-l-teal-400", avatar: "bg-teal-100 dark:bg-teal-900/40", text: "text-teal-700 dark:text-teal-300" },
  Health: { border: "border-l-red-400", avatar: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-300" },
  Government: { border: "border-l-slate-400", avatar: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300" },
};

function toEncryptedDoc(snapshot: QueryDocumentSnapshot<DocumentData>): EncryptedCredentialDoc {
  const data = snapshot.data();
  const ownerId = String(data.ownerId || snapshot.ref.parent.parent?.id || "");
  return {
    id: snapshot.id,
    ownerId,
    encrypted: data.encrypted === true,
    cipher: data.cipher,
    wrappedKeys: data.wrappedKeys,
    sharedWith: data.sharedWith,
    editors: data.editors,
    individualShares: data.individualShares,
    individualAccess: data.individualAccess,
    individualEditors: data.individualEditors,
    legacy: data.encrypted === true ? undefined : {
      name: data.name,
      url: data.url,
      username: data.username,
      email: data.email,
      password: data.password,
      notes: data.notes,
      category: data.category,
    },
  };
}

function CredentialCard({
  credential,
  ownerName,
  canEdit,
  canShare,
  canDelete,
  onEdit,
  onDelete,
  onShare,
}: {
  credential: VaultCredential;
  ownerName?: string;
  canEdit: boolean;
  canShare: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState("");
  const fields = credentialFields(credential);
  const style = CAT_STYLES[credential.category || ""] || {
    border: "border-l-primary/50",
    avatar: "bg-primary/10",
    text: "text-primary",
  };

  const copy = async (value: string, field: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(field);
    window.setTimeout(() => setCopied(""), 1400);
  };

  const row = (field: CredentialField) => (
    <div className="flex min-w-0 items-center gap-2 rounded-xl bg-muted/45 px-3 py-2">
      <span className="shrink-0 text-muted-foreground">{fieldIcon(field.type)}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{field.label}</span>
        <span className={`block truncate text-xs ${secretField(field.type) ? "font-mono tracking-wide" : ""}`}>
          {secretField(field.type) && !visibleSecrets[field.id] ? "•".repeat(Math.min(field.value.length, 18)) : field.value}
        </span>
      </span>
      {secretField(field.type) && (
        <button type="button" onClick={() => setVisibleSecrets((current) => ({ ...current, [field.id]: !current[field.id] }))} className="text-muted-foreground hover:text-foreground">
          {visibleSecrets[field.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      )}
      <button type="button" onClick={() => void copy(field.value, field.id)} className="text-muted-foreground hover:text-foreground">
        {copied === field.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className={`overflow-hidden rounded-2xl border border-border/60 border-l-4 ${style.border} bg-card shadow-card`}
    >
      <button type="button" onClick={() => setExpanded((value) => !value)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/25">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${style.avatar} ${style.text}`}>
          {credential.name.slice(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{credential.name}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {ownerName ? `Shared by ${ownerName}` : fields.find((field) => !secretField(field.type))?.value || "Saved login"}
          </span>
        </span>
        {credential.individualShares.length > 0 && canShare && <Share2 className="h-3.5 w-3.5 text-primary" />}
        {credential.category && <span className="rounded-full bg-muted px-2 py-1 text-[9px] font-semibold">{credential.category}</span>}
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 border-t border-border/50 px-4 py-4">
              {fields.filter((field) => field.value).map((field) => <div key={field.id}>{row(field)}</div>)}
              {credential.notes && <p className="rounded-xl bg-muted/45 px-3 py-2 text-xs leading-relaxed text-muted-foreground">{credential.notes}</p>}
              <div className="flex gap-2 pt-1">
                {canEdit && (
                  <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={onEdit}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                  </Button>
                )}
                {canShare && (
                  <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={onShare}>
                    <Share2 className="mr-1.5 h-3.5 w-3.5" /> Share login
                  </Button>
                )}
                {canDelete && (
                  <Button variant="ghost" size="icon" className="rounded-xl text-destructive" onClick={onDelete}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

export default function LogInDetails() {
  const { dataUid } = useAuth();
  const appUsers = useAppUsers();
  const { scopeUserId, permission, pageTitle, isOwnScope } = useSharedScope("login_details");
  const { mine: pageShares } = usePageShares("login_details");
  const [config, setConfig] = useState<PasswordVaultConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [sourceDocs, setSourceDocs] = useState<EncryptedCredentialDoc[]>([]);
  const [individualDocs, setIndividualDocs] = useState<EncryptedCredentialDoc[]>([]);
  const [credentials, setCredentials] = useState<VaultCredential[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCredential, setEditCredential] = useState<VaultCredential | null>(null);
  const [shareCredential, setShareCredential] = useState<VaultCredential | null>(null);
  const [form, setForm] = useState<PlainCredential>({ ...EMPTY });
  const [fieldChoice, setFieldChoice] = useState("");
  const [customFieldLabel, setCustomFieldLabel] = useState("");
  const [visibleFormSecrets, setVisibleFormSecrets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");

  const unlocked = !!privateKey;
  const ownerId = scopeUserId || dataUid;
  const userName = useCallback(
    (uid: string) => appUsers.find((user) => user.id === uid)?.name || "Another user",
    [appUsers],
  );

  useEffect(() => {
    if (!dataUid) return;
    return onSnapshot(
      doc(db, "users", dataUid, "vault", "config"),
      (snapshot) => {
        setConfig(snapshot.exists() ? snapshot.data() as PasswordVaultConfig : null);
        setConfigLoading(false);
      },
      () => {
        setConfig(null);
        setConfigLoading(false);
      },
    );
  }, [dataUid]);

  const unlock = useCallback(async (privateJwk: JsonWebKey) => {
    setPrivateKey(await importPrivateKey(privateJwk));
  }, []);

  const setup = useCallback(async (
    nextConfig: PasswordVaultConfig,
    publicProfile: VaultPublicKey,
    privateJwk: JsonWebKey,
  ) => {
    if (!dataUid) return;
    await Promise.all([
      setDoc(doc(db, "users", dataUid, "vault", "config"), {
        ...nextConfig,
        updatedAt: serverTimestamp(),
      }),
      setDoc(doc(db, "vaultPublicKeys", dataUid), {
        ...publicProfile,
        ownerId: dataUid,
        updatedAt: serverTimestamp(),
      }),
    ]);
    setConfig(nextConfig);
    await unlock(privateJwk);
  }, [dataUid, unlock]);

  useEffect(() => {
    if (!unlocked) return;
    const lock = () => setPrivateKey(null);
    const timer = window.setTimeout(lock, 10 * 60 * 1000);
    const visibility = () => {
      if (document.visibilityState === "hidden") window.setTimeout(() => {
        if (document.visibilityState === "hidden") lock();
      }, 60_000);
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked || !ownerId) {
      setSourceDocs([]);
      return;
    }
    setLoading(true);
    return onSnapshot(
      collection(db, "users", ownerId, "credentials"),
      (snapshot) => {
        setSourceDocs(snapshot.docs.map(toEncryptedDoc));
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        toast.error(error.code === "permission-denied" ? "You no longer have access to this vault" : "Could not load this vault");
      },
    );
  }, [ownerId, unlocked]);

  useEffect(() => {
    if (!unlocked || !dataUid || !isOwnScope) {
      setIndividualDocs([]);
      return;
    }
    const sharedQuery = query(collectionGroup(db, "credentials"), where("individualAccess", "array-contains", dataUid));
    return onSnapshot(sharedQuery, (snapshot) => {
      setIndividualDocs(snapshot.docs.map(toEncryptedDoc).filter((item) => item.ownerId !== dataUid));
    }, () => setIndividualDocs([]));
  }, [dataUid, isOwnScope, unlocked]);

  useEffect(() => {
    if (!privateKey || !dataUid) {
      setCredentials([]);
      return;
    }
    let cancelled = false;
    const decryptAll = async () => {
      const combined = [...sourceDocs, ...individualDocs]
        .filter((item, index, all) => all.findIndex((other) => `${other.ownerId}:${other.id}` === `${item.ownerId}:${item.id}`) === index);
      const decrypted = await Promise.all(combined.map(async (item) => {
        if (!item.encrypted || !item.cipher) return null;
        const wrappedKey = item.wrappedKeys?.[dataUid];
        if (!wrappedKey) return null;
        try {
          const result = await decryptCredential(item.cipher, wrappedKey, privateKey);
          return {
            ...result.credential,
            id: item.id,
            ownerId: item.ownerId,
            itemKey: result.itemKey,
            wrappedKeys: item.wrappedKeys || {},
            sharedWith: item.sharedWith || [],
            editors: item.editors || [],
            individualShares: item.individualShares || [],
            individualAccess: item.individualAccess || [],
            individualEditors: item.individualEditors || [],
          } satisfies VaultCredential;
        } catch {
          return null;
        }
      }));
      if (!cancelled) setCredentials(decrypted.filter(Boolean) as VaultCredential[]);
    };
    void decryptAll();
    return () => { cancelled = true; };
  }, [dataUid, individualDocs, privateKey, sourceDocs]);

  useEffect(() => {
    if (!privateKey || !dataUid) return;
    const legacy = sourceDocs.filter((item) => item.ownerId === dataUid && !item.encrypted && item.legacy?.name && item.legacy?.password);
    if (!legacy.length) return;
    void (async () => {
      const profile = await getDoc(doc(db, "vaultPublicKeys", dataUid));
      if (!profile.exists()) return;
      const publicKey = (profile.data() as VaultPublicKey).publicKey;
      await Promise.all(legacy.map(async (item) => {
        const encrypted = await encryptCredential(item.legacy as PlainCredential, dataUid, publicKey);
        await updateDoc(doc(db, "users", dataUid, "credentials", item.id), {
          ownerId: dataUid,
          ...encrypted,
          sharedWith: [],
          editors: [],
          individualShares: [],
          individualAccess: [],
          individualEditors: [],
          name: deleteField(),
          url: deleteField(),
          username: deleteField(),
          email: deleteField(),
          password: deleteField(),
          notes: deleteField(),
          category: deleteField(),
          updatedAt: serverTimestamp(),
        });
      }));
      toast.success(`${legacy.length} existing login${legacy.length === 1 ? "" : "s"} secured`);
    })().catch(() => toast.error("Some existing logins could not be encrypted"));
  }, [dataUid, privateKey, sourceDocs]);

  useEffect(() => {
    if (!dataUid || !privateKey || !isOwnScope || credentials.length === 0) return;
    let cancelled = false;
    void (async () => {
      const profiles = new Map<string, JsonWebKey>();
      await Promise.all(pageShares.map(async (share) => {
        const snapshot = await getDoc(doc(db, "vaultPublicKeys", share.targetUid));
        if (snapshot.exists()) profiles.set(share.targetUid, (snapshot.data() as VaultPublicKey).publicKey);
      }));

      for (const credential of credentials.filter((item) => item.ownerId === dataUid)) {
        if (cancelled) return;
        const grants = new Map<string, SharePermission>();
        credential.individualShares.forEach((share) => grants.set(share.uid, share.permission));
        pageShares.forEach((share) => grants.set(share.targetUid, share.permission));
        const wrappedKeys: Record<string, string> = {};
        if (credential.wrappedKeys[dataUid]) wrappedKeys[dataUid] = credential.wrappedKeys[dataUid];
        for (const [uid] of grants) {
          const publicKey = profiles.get(uid) || (await getDoc(doc(db, "vaultPublicKeys", uid))).data()?.publicKey;
          if (!publicKey) continue;
          wrappedKeys[uid] = credential.wrappedKeys[uid] || await wrapCredentialKey(credential.itemKey, publicKey);
        }
        const sharedWith = [...grants.keys()].filter((uid) => !!wrappedKeys[uid]);
        const editors = [...grants.entries()].filter(([, value]) => value === "edit").map(([uid]) => uid);
        const individualAccess = credential.individualShares.map((share) => share.uid);
        const individualEditors = credential.individualShares
          .filter((share) => share.permission === "edit")
          .map((share) => share.uid);
        const changed = JSON.stringify(wrappedKeys) !== JSON.stringify(
          credential.wrappedKeys,
        ) || JSON.stringify([...credential.sharedWith].sort()) !== JSON.stringify([...sharedWith].sort())
          || JSON.stringify([...credential.editors].sort()) !== JSON.stringify([...editors].sort())
          || JSON.stringify([...credential.individualAccess].sort()) !== JSON.stringify([...individualAccess].sort())
          || JSON.stringify([...credential.individualEditors].sort()) !== JSON.stringify([...individualEditors].sort());
        if (changed) {
          await updateDoc(doc(db, "users", dataUid, "credentials", credential.id), {
            wrappedKeys,
            sharedWith,
            editors,
            individualAccess,
            individualEditors,
            updatedAt: serverTimestamp(),
          });
        }
      }
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [credentials, dataUid, isOwnScope, pageShares, privateKey]);

  const openAdd = () => {
    setEditCredential(null);
    setForm({ ...EMPTY, fields: [] });
    setFieldChoice("");
    setCustomFieldLabel("");
    setVisibleFormSecrets({});
    setDialogOpen(true);
  };

  const openEdit = (credential: VaultCredential) => {
    setEditCredential(credential);
    setForm({
      name: credential.name,
      url: credential.url || "",
      username: credential.username || "",
      email: credential.email || "",
      password: credential.password,
      fields: credentialFields(credential),
      notes: credential.notes || "",
      category: credential.category || "",
    });
    setFieldChoice("");
    setCustomFieldLabel("");
    setVisibleFormSecrets({});
    setDialogOpen(true);
  };

  const addField = (type: CredentialFieldType, label?: string) => {
    setForm((current) => ({ ...current, fields: [...(current.fields || []), newField(type, label)] }));
    setFieldChoice("");
    setCustomFieldLabel("");
  };

  const updateField = (id: string, patch: Partial<CredentialField>) => {
    setForm((current) => ({
      ...current,
      fields: (current.fields || []).map((field) => field.id === id ? { ...field, ...patch } : field),
    }));
  };

  const removeField = (id: string) => {
    setForm((current) => ({ ...current, fields: (current.fields || []).filter((field) => field.id !== id) }));
  };

  const save = async () => {
    if (!dataUid || !form.name.trim()) return;
    setSaving(true);
    const fields = (form.fields || [])
      .filter((field) => field.label.trim() && (secretField(field.type) ? field.value.length > 0 : field.value.trim()))
      .map((field) => ({
        ...field,
        label: field.label.trim(),
        value: secretField(field.type) ? field.value : field.value.trim(),
      }));
    const firstValue = (type: CredentialFieldType) => fields.find((field) => field.type === type)?.value || "";
    const cleaned: PlainCredential = {
      name: form.name.trim(),
      fields,
      url: firstValue("website"),
      username: firstValue("username"),
      email: firstValue("email"),
      password: firstValue("password"),
      notes: form.notes?.trim() || "",
      category: form.category || "",
    };
    try {
      if (editCredential) {
        await updateDoc(doc(db, "users", editCredential.ownerId, "credentials", editCredential.id), {
          cipher: await encryptCredentialWithItemKey(cleaned, editCredential.itemKey),
          updatedAt: serverTimestamp(),
        });
      } else {
        const profile = await getDoc(doc(db, "vaultPublicKeys", dataUid));
        if (!profile.exists()) throw new Error("Your vault key is missing");
        const encrypted = await encryptCredential(cleaned, dataUid, (profile.data() as VaultPublicKey).publicKey);
        await addDoc(collection(db, "users", dataUid, "credentials"), {
          ownerId: dataUid,
          ...encrypted,
          sharedWith: [],
          editors: [],
          individualShares: [],
          individualAccess: [],
          individualEditors: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setDialogOpen(false);
      toast.success(editCredential ? "Login updated" : "Login saved securely");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this login");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (credential: VaultCredential) => {
    if (credential.ownerId !== dataUid) return;
    if (!window.confirm(`Delete ${credential.name}? This cannot be undone.`)) return;
    await deleteDoc(doc(db, "users", credential.ownerId, "credentials", credential.id));
    toast.success("Login deleted");
  };

  const updateIndividualShare = async (targetUid: string, nextPermission: SharePermission | null) => {
    if (!shareCredential || shareCredential.ownerId !== dataUid) return;
    const individualShares = shareCredential.individualShares.filter((share) => share.uid !== targetUid);
    if (nextPermission) individualShares.push({ uid: targetUid, permission: nextPermission });
    const pageGrant = pageShares.find((share) => share.targetUid === targetUid);
    const shouldRetain = !!nextPermission || !!pageGrant;
    const wrappedKeys = { ...shareCredential.wrappedKeys };
    if (shouldRetain && !wrappedKeys[targetUid]) {
      const profile = await getDoc(doc(db, "vaultPublicKeys", targetUid));
      if (!profile.exists()) throw new Error(`${userName(targetUid)} needs to set up their password vault first`);
      wrappedKeys[targetUid] = await wrapCredentialKey(shareCredential.itemKey, (profile.data() as VaultPublicKey).publicKey);
    }
    if (!shouldRetain) delete wrappedKeys[targetUid];
    const grants = new Map<string, SharePermission>();
    individualShares.forEach((share) => grants.set(share.uid, share.permission));
    pageShares.forEach((share) => grants.set(share.targetUid, share.permission));
    const individualAccess = individualShares.map((share) => share.uid);
    const individualEditors = individualShares
      .filter((share) => share.permission === "edit")
      .map((share) => share.uid);
    await updateDoc(doc(db, "users", dataUid, "credentials", shareCredential.id), {
      individualShares,
      individualAccess,
      individualEditors,
      wrappedKeys,
      sharedWith: [...grants.keys()].filter((uid) => !!wrappedKeys[uid]),
      editors: [...grants.entries()].filter(([, value]) => value === "edit").map(([uid]) => uid),
      updatedAt: serverTimestamp(),
    });
    setShareCredential((current) => current
      ? { ...current, individualShares, individualAccess, individualEditors, wrappedKeys }
      : null);
  };

  const usedCategories = useMemo(
    () => [...new Set(credentials.map((credential) => credential.category).filter(Boolean))] as string[],
    [credentials],
  );
  const filtered = useMemo(() => credentials.filter((credential) => {
    const matchesCategory = category === "All" || credential.category === category;
    const needle = search.trim().toLowerCase();
    const matchesSearch = !needle || [credential.name, ...credentialFields(credential).map((field) => field.value)]
      .some((value) => value?.toLowerCase().includes(needle));
    return matchesCategory && matchesSearch;
  }).sort((a, b) => a.name.localeCompare(b.name)), [category, credentials, search]);

  const canEditCredential = (credential: VaultCredential) => credential.ownerId === dataUid
    || (permission === "edit" && credential.ownerId === ownerId)
    || credential.individualEditors.includes(dataUid || "");

  return (
    <FeaturePageShell
      title={pageTitle}
      subtitle={unlocked ? (isOwnScope ? "Encrypted passwords and secure sharing" : "Securely shared with you") : "Private, encrypted and protected"}
      icon={<KeyRound className="h-5 w-5" />}
      sharePage={unlocked && isOwnScope ? "login_details" : undefined}
    >
      {!unlocked ? (
        <PasswordVaultGate config={config} loading={configLoading} onSetup={setup} onUnlock={(key) => void unlock(key)} />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-primary/20 bg-[color-mix(in_srgb,hsl(var(--primary))_10%,hsl(var(--card)))] p-4 shadow-card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-sm">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">Vault unlocked</span>
                  <span className="block text-xs text-muted-foreground">Passwords lock automatically after 10 minutes</span>
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setPrivateKey(null)}>
                  <LockKeyhole className="mr-1.5 h-3.5 w-3.5" /> Lock now
                </Button>
                {isOwnScope && (
                  <Button size="sm" className="rounded-xl bg-gradient-primary" onClick={openAdd}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add login
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[12rem_minmax(0,1fr)]">
            <aside className="h-fit rounded-2xl border border-border/60 bg-card p-3 shadow-card">
              <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Categories</p>
              {["All", ...usedCategories].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors ${
                    category === item ? "bg-gradient-primary text-primary-foreground shadow-sm" : "hover:bg-muted"
                  }`}
                >
                  {item}
                  <span className="text-[10px] opacity-75">
                    {item === "All" ? credentials.length : credentials.filter((credential) => credential.category === item).length}
                  </span>
                </button>
              ))}
            </aside>

            <section className="min-w-0 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search saved logins" className="h-10 rounded-xl bg-card pl-9 shadow-sm" />
              </div>
              {loading ? (
                <div className="rounded-2xl bg-card py-12 text-center text-sm text-muted-foreground shadow-card">Decrypting your logins…</div>
              ) : filtered.length === 0 ? (
                <div className="rounded-2xl border border-border/60 bg-card px-6 py-14 text-center shadow-card">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <KeyRound className="h-6 w-6" />
                  </div>
                  <p className="mt-3 text-sm font-semibold">{search || category !== "All" ? "No matching logins" : "Your vault is ready"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isOwnScope ? "Add your first login and it will be encrypted before saving." : "No logins have been shared in this vault yet."}
                  </p>
                  {isOwnScope && !search && category === "All" && (
                    <Button size="sm" className="mt-4 rounded-xl bg-gradient-primary" onClick={openAdd}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Add first login
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {filtered.map((credential) => (
                      <CredentialCard
                        key={`${credential.ownerId}:${credential.id}`}
                        credential={credential}
                        ownerName={credential.ownerId === dataUid ? undefined : userName(credential.ownerId)}
                        canEdit={canEditCredential(credential)}
                        canShare={credential.ownerId === dataUid}
                        canDelete={credential.ownerId === dataUid}
                        onEdit={() => openEdit(credential)}
                        onDelete={() => void remove(credential)}
                        onShare={() => setShareCredential(credential)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="font-display">{editCredential ? "Edit login" : "Add a login"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name *</Label><Input value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} placeholder="Tesco, Netflix, HMRC…" className="rounded-xl" /></div>
            <div className="space-y-2">
              {(form.fields || []).map((field) => (
                <motion.div layout key={field.id} className="rounded-2xl border border-border/60 bg-muted/25 p-3">
                  <div className="mb-1.5 flex items-center gap-2">
                    {field.type === "other" ? (
                      <Input
                        value={field.label}
                        onChange={(event) => updateField(field.id, { label: event.target.value })}
                        aria-label="Custom field name"
                        className="h-7 flex-1 rounded-lg bg-card px-2 text-xs font-semibold"
                      />
                    ) : (
                      <Label className="flex-1">{field.label}</Label>
                    )}
                    <button type="button" onClick={() => removeField(field.id)} className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Remove ${field.label}`}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      type={secretField(field.type) && !visibleFormSecrets[field.id]
                        ? "password"
                        : field.type === "email" ? "email" : field.type === "phone" ? "tel" : field.type === "website" ? "url" : "text"}
                      value={field.value}
                      onChange={(event) => updateField(field.id, { value: event.target.value })}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                      className={`rounded-xl bg-card ${secretField(field.type) ? "pr-10" : ""}`}
                    />
                    {secretField(field.type) && (
                      <button type="button" onClick={() => setVisibleFormSecrets((current) => ({ ...current, [field.id]: !current[field.id] }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {visibleFormSecrets[field.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="rounded-2xl border border-primary/20 bg-[color-mix(in_srgb,hsl(var(--primary))_8%,hsl(var(--card)))] p-3">
              <Label className="mb-1.5 block">Add a field</Label>
              <select
                value={fieldChoice}
                onChange={(event) => {
                  const type = event.target.value as CredentialFieldType | "";
                  setFieldChoice(type);
                  if (type && type !== "other") addField(type);
                }}
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground"
              >
                <option value="">Choose what to add…</option>
                {FIELD_OPTIONS.map((option) => <option key={option.type} value={option.type}>{option.label}</option>)}
              </select>
              {fieldChoice === "other" && (
                <div className="mt-2 flex gap-2">
                  <Input value={customFieldLabel} onChange={(event) => setCustomFieldLabel(event.target.value)} placeholder="Field name, e.g. Security answer" className="rounded-xl bg-card" />
                  <Button type="button" size="sm" disabled={!customFieldLabel.trim()} onClick={() => addField("other", customFieldLabel.trim())} className="h-10 rounded-xl">
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((item) => (
                  <button key={item} type="button" onClick={() => setForm((value) => ({ ...value, category: value.category === item ? "" : item }))} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${form.category === item ? "bg-gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Secure notes</Label>
              <Textarea value={form.notes} onChange={(event) => setForm((value) => ({ ...value, notes: event.target.value }))} placeholder="Recovery details or anything else you need to remember…" className="min-h-24 resize-y rounded-xl" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button className="flex-1 rounded-xl bg-gradient-primary" disabled={saving || !form.name.trim()} onClick={() => void save()}>
                {saving ? "Encrypting…" : "Save securely"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!shareCredential} onOpenChange={(open) => !open && setShareCredential(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Share2 className="h-4 w-4" /> Share {shareCredential?.name}</DialogTitle>
            <DialogDescription>Only this login will be shared. Its encryption key is protected for each person separately.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto">
            {appUsers.filter((user) => user.id !== dataUid).map((user) => {
              const existing = shareCredential?.individualShares.find((share) => share.uid === user.id);
              return (
                <div key={user.id} className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{user.name}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">{user.email}</span>
                  </span>
                  <select
                    value={existing?.permission || ""}
                    onChange={(event) => {
                      const value = event.target.value as SharePermission | "";
                      void updateIndividualShare(user.id, value || null).catch((error) => toast.error(error instanceof Error ? error.message : "Could not update sharing"));
                    }}
                    className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs"
                  >
                    <option value="">Not shared</option>
                    <option value="view">Can view</option>
                    <option value="edit">Can edit</option>
                  </select>
                </div>
              );
            })}
          </div>
          <Button variant="outline" className="w-full rounded-xl" onClick={() => setShareCredential(null)}>
            <X className="mr-1.5 h-3.5 w-3.5" /> Done
          </Button>
        </DialogContent>
      </Dialog>
    </FeaturePageShell>
  );
}
