"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Send, Loader2 } from "lucide-react";
import { fetchComments, postComment } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

const TOKEN_KEY = "civicfault_authority_token";

function authorHash(): string {
  if (typeof window === "undefined") return "anon";
  const key = "civicfault_voter";
  let h = localStorage.getItem(key);
  if (!h) {
    h = `v_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, h);
  }
  return h;
}

export function ReportChat({ reportId }: { reportId: number }) {
  const [items, setItems] = useState<
    { id: number; author_label: string; is_staff: boolean; body: string; created_at: string }[]
  >([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetchComments(reportId)
      .then((d) => setItems(d.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const token = localStorage.getItem(TOKEN_KEY) || undefined;
      const created = await postComment(
        reportId,
        { body: body.trim(), author_label: "Resident", author_hash: authorHash() },
        token
      );
      setItems((prev) => [...prev, created]);
      setBody("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t border-slate-100 pt-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
        <MessageCircle className="w-4 h-4" />
        Discussion
        <span className="text-xs font-normal text-slate-400">{items.length}</span>
      </div>

      {loading && (
        <div className="flex justify-center py-4 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <p className="text-xs text-slate-400">No messages yet. Ask a question or leave an update.</p>
      )}

      <ul className="space-y-2 max-h-48 overflow-y-auto">
        {items.map((c) => (
          <li
            key={c.id}
            className={`rounded-xl px-3 py-2 text-sm ${
              c.is_staff ? "bg-violet-50 border border-violet-100" : "bg-slate-50 border border-slate-100"
            }`}
          >
            <div className="flex justify-between gap-2 text-[11px] text-slate-500 mb-0.5">
              <span className="font-medium text-slate-700">
                {c.author_label}
                {c.is_staff ? " · Staff" : ""}
              </span>
              <span>{formatDateTime(c.created_at)}</span>
            </div>
            <p className="text-slate-800 whitespace-pre-wrap">{c.body}</p>
          </li>
        ))}
      </ul>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <form onSubmit={onSend} className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message…"
          maxLength={2000}
          className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="shrink-0 rounded-xl bg-slate-900 text-white px-3 py-2 disabled:opacity-50"
          aria-label="Send"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}
