import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useApp } from "@/lib/app-context";
import { signedUrl, uploadFile } from "@/lib/media";
import { beep } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Msg = { id: string; user_id: string; sender: string; body: string | null; image_path: string | null; created_at: string; read_by_user: boolean; read_by_admin: boolean };

function ChatImage({ path, onOpen }: { path: string; onOpen: (u: string) => void }) {
  const { data } = useQuery({ queryKey: ["signed", path], staleTime: 50 * 60_000, queryFn: () => signedUrl(path) });
  if (!data) return <div className="h-32 w-40 animate-pulse rounded-lg bg-muted" />;
  return <img src={data} alt="Attachment" onClick={() => onOpen(data)} className="max-h-56 max-w-[220px] cursor-zoom-in rounded-lg object-cover" />;
}

/** Private conversation between one user and admin. `as` decides which side is "me". */
export function ChatThread({ userId, as }: { userId: string; as: "user" | "admin" }) {
  const { t } = useApp();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const key = ["chat", userId];

  const { data: msgs, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => ((await supabase.from("chat_messages").select("*").eq("user_id", userId).order("created_at").limit(300)).data ?? []) as Msg[],
  });

  useEffect(() => {
    const ch = supabase.channel(`chat-${userId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `user_id=eq.${userId}` }, (p) => {
        const m = p.new as Msg;
        qc.setQueryData<Msg[]>(key, (old) => (old?.some((x) => x.id === m.id) ? old : [...(old ?? []), m]));
        if (m.sender !== as) beep("chip");
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    const unread = msgs?.filter((m) => m.sender !== as && !(as === "user" ? m.read_by_user : m.read_by_admin));
    if (unread?.length) {
      const col = as === "user" ? "read_by_user" : "read_by_admin";
      supabase.from("chat_messages").update({ [col]: true }).in("id", unread.map((m) => m.id)).then(() => {
        qc.invalidateQueries({ queryKey: ["chat-unread"] });
        qc.invalidateQueries({ queryKey: ["admin-convos"] });
      });
    }
  }, [msgs]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (image_path?: string) => {
    const body = text.trim();
    if (!body && !image_path) return;
    setBusy(true);
    const { data, error } = await supabase.from("chat_messages").insert({ user_id: userId, sender: as, body: body || null, image_path: image_path ?? null, read_by_user: as === "user", read_by_admin: as === "admin" }).select().single();
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    setText("");
    qc.setQueryData<Msg[]>(key, (old) => (old?.some((x) => x.id === data.id) ? old : [...(old ?? []), data as Msg]));
  };

  const onFile = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try { const p = await uploadFile(userId, f); await send(p); } catch (e) { toast.error(errMsg(e)); setBusy(false); }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {isLoading ? <div className="grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          : !msgs?.length ? <p className="py-10 text-center text-sm text-muted-foreground">{t("chat.empty")}</p>
          : msgs.map((m) => {
            const mine = m.sender === as;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-card", mine ? "rounded-br-sm bg-gradient-primary text-primary-foreground" : "rounded-bl-sm bg-card")}>
                  {m.image_path && <ChatImage path={m.image_path} onOpen={setPreview} />}
                  {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                  <p className={cn("mt-0.5 text-[10px]", mine ? "text-primary-foreground/75" : "text-muted-foreground")}>{new Date(m.created_at).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}</p>
                </div>
              </div>
            );
          })}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-2 border-t border-border bg-card p-2">
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <button type="button" onClick={() => fileRef.current?.click()} aria-label={t("chat.image")} className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-secondary-foreground"><ImagePlus className="h-5 w-5" /></button>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder={t("chat.placeholder")} className="h-10 flex-1 rounded-full border border-input bg-background px-4 text-sm outline-none focus:border-primary" />
        <button type="submit" disabled={busy} aria-label={t("chat.send")} className="grid h-10 w-10 place-items-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 rtl:rotate-180" />}</button>
      </form>
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl p-2"><DialogTitle className="sr-only">Image</DialogTitle>{preview && <img src={preview} alt="Preview" className="w-full rounded-lg" />}</DialogContent>
      </Dialog>
    </div>
  );
}

export function useChatUnread() {
  const { session } = useApp();
  return useQuery({
    queryKey: ["chat-unread", session?.user.id],
    enabled: !!session,
    refetchInterval: 20000,
    queryFn: async () => (await supabase.from("chat_messages").select("id", { count: "exact", head: true }).eq("user_id", session!.user.id).eq("sender", "admin").eq("read_by_user", false)).count ?? 0,
  });
}
