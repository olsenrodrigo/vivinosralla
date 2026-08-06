import { useEffect, useState } from "react";
import { Star, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Review {
  id: number;
  rating: number;
  authorName: string;
  title: string | null;
  comment: string | null;
  verifiedPurchase: boolean;
  adminReply: string | null;
  createdAt: string;
}
interface Aggregate { count: number; average: number; distribution: Record<number, number>; }

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={size} className={i + 1 <= Math.round(value) ? "text-amber-400" : "text-gray-300"} fill={i + 1 <= Math.round(value) ? "currentColor" : "none"} />
      ))}
    </span>
  );
}

export default function ReviewsSection({ slug, primaryColor = "#5B8C9B" }: { slug: string; primaryColor?: string }) {
  const [aggregate, setAggregate] = useState<Aggregate | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const [done, setDone] = useState<null | "pending" | "approved">(null);
  const [form, setForm] = useState({ rating: 5, authorName: "", comment: "", authorEmail: "", orderNumber: "", website: "" });

  const load = () => {
    fetch(`/api/store/products/${slug}/reviews`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setAggregate(d.aggregate); setReviews(d.reviews); setEnabled(d.reviewsEnabled !== false); } })
      .catch(() => {});
  };
  useEffect(() => { load(); }, [slug]);

  const submit = async () => {
    if (!form.authorName.trim()) return;
    setSubmitting(true); setError(false);
    try {
      const res = await fetch(`/api/store/products/${slug}/reviews`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: form.rating, authorName: form.authorName.trim(),
          comment: form.comment.trim() || null, authorEmail: form.authorEmail.trim() || null,
          orderNumber: form.orderNumber.trim() || null, website: form.website,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        setDone(d.status === "approved" ? "approved" : "pending"); setShowForm(false);
        setForm({ rating: 5, authorName: "", comment: "", authorEmail: "", orderNumber: "", website: "" });
        if (d.status === "approved") load();
      } else setError(true);
    } catch { setError(true); } finally { setSubmitting(false); }
  };

  const count = aggregate?.count ?? 0;

  return (
    <section className="mt-12 border-t pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Avaliações</h2>
          {count > 0 ? (
            <div className="mt-2 flex items-center gap-2">
              <Stars value={aggregate!.average} size={18} />
              <span className="text-lg font-semibold text-gray-800">{aggregate!.average.toFixed(1)}</span>
              <span className="text-sm text-gray-500">({count})</span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-500">Ainda não há avaliações. Seja o primeiro!</p>
          )}
        </div>
        {enabled && (
          <Button onClick={() => { setShowForm((s) => !s); setDone(null); setError(false); }} className="text-white" style={{ background: primaryColor }}>
            Escrever avaliação
          </Button>
        )}
      </div>

      {done && <p className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{done === "pending" ? "Obrigado! Sua avaliação aparecerá após moderação." : "Obrigado pela sua avaliação!"}</p>}
      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">Não foi possível enviar. Tente novamente.</p>}

      {count > 0 && (
        <div className="mt-6 max-w-md space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const n = aggregate!.distribution[star] ?? 0;
            const pct = count ? Math.round((n / count) * 100) : 0;
            return (
              <div key={star} className="flex items-center gap-3 text-sm">
                <span className="w-8 text-gray-500">{star}★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 text-right text-xs text-gray-400">{n}</span>
              </div>
            );
          })}
        </div>
      )}

      {enabled && showForm && (
        <div className="mt-6 rounded-xl border bg-white p-5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">Sua nota:</span>
            {Array.from({ length: 5 }).map((_, i) => (
              <button key={i} type="button" onClick={() => setForm((f) => ({ ...f, rating: i + 1 }))}>
                <Star size={22} className={i + 1 <= form.rating ? "text-amber-400" : "text-gray-300"} fill={i + 1 <= form.rating ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input value={form.authorName} onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))} placeholder="Seu nome" />
            <Input value={form.authorEmail} onChange={(e) => setForm((f) => ({ ...f, authorEmail: e.target.value }))} placeholder="E-mail (opcional)" />
          </div>
          <Input value={form.orderNumber} onChange={(e) => setForm((f) => ({ ...f, orderNumber: e.target.value }))} placeholder="Nº do pedido (opcional, verifica a compra)" className="mt-3" />
          <textarea value={form.comment} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))} placeholder="Conte como foi sua experiência..." rows={4} className="mt-3 w-full rounded-md border px-3 py-2 text-sm" />
          <input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={submitting || !form.authorName.trim()} className="text-white" style={{ background: primaryColor }}>{submitting ? "..." : "Enviar avaliação"}</Button>
          </div>
        </div>
      )}

      <div className="mt-8 space-y-4">
        {reviews.map((r) => (
          <div key={r.id} className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Stars value={r.rating} size={14} />
                <span className="font-semibold text-gray-800">{r.authorName}</span>
                {r.verifiedPurchase && <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600"><BadgeCheck size={13} /> Compra verificada</span>}
              </div>
              <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString("pt-BR")}</span>
            </div>
            {r.title && <p className="mt-2 font-semibold text-gray-800">{r.title}</p>}
            {r.comment && <p className="mt-1 text-sm text-gray-600">{r.comment}</p>}
            {r.adminReply && (
              <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm">
                <span className="font-semibold text-gray-700">Resposta da loja: </span>
                <span className="text-gray-600">{r.adminReply}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
