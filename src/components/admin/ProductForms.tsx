"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiSend, apiUpload } from "@/lib/client/api";

const TYPES = [
  "SAMPLE_PACK",
  "PRESET_PACK",
  "TEMPLATE",
  "MIDI_PACK",
  "STEM_PACK",
  "GUIDE",
  "OTHER",
] as const;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function ProductCreateForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const result = await apiSend<{ product: { id: string } }>("/api/admin/products", {
      title,
      slug: slug || slugify(title),
      subtitle: form.get("subtitle"),
      description: form.get("description"),
      type: form.get("type"),
      minTier: Number(form.get("minTier")),
      published: false,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    router.push(`/admin/products/${result.data.product.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card p-7">
      <p className="eyebrow">Neues Produkt</p>

      {error && (
        <p className="mt-5 border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>
      )}

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="title">Titel</label>
          <input
            id="title"
            className="field"
            required
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (!slug) setSlug("");
            }}
          />
        </div>
        <div>
          <label className="label" htmlFor="slug">Slug</label>
          <input
            id="slug"
            className="field"
            placeholder={slugify(title) || "z-b-neon-drums-vol-1"}
            value={slug}
            onChange={(event) => setSlug(slugify(event.target.value))}
          />
        </div>
        <div>
          <label className="label" htmlFor="type">Typ</label>
          <select id="type" name="type" className="field" defaultValue="SAMPLE_PACK">
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="minTier">Mindest-Tier</label>
          <select id="minTier" name="minTier" className="field" defaultValue="1">
            <option value="1">1 — Starter</option>
            <option value="2">2 — Pro</option>
            <option value="3">3 — Ultimate</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="subtitle">Untertitel</label>
          <input id="subtitle" name="subtitle" className="field" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="description">Beschreibung</label>
          <textarea id="description" name="description" rows={4} className="field" />
        </div>
      </div>

      <button type="submit" className="btn btn-primary mt-7" disabled={pending || !title}>
        {pending ? "Wird angelegt …" : "Produkt anlegen"}
      </button>
    </form>
  );
}

export function PublishToggle({
  productId,
  published,
  minTier,
}: {
  productId: string;
  published: boolean;
  minTier: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function update(payload: { published?: boolean; minTier?: number }) {
    setPending(true);
    await apiSend("/api/admin/products", { productId, ...payload }, "PATCH");
    setPending(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className="btn btn-ghost !px-4 !py-2 text-[10px]"
        disabled={pending}
        onClick={() => update({ published: !published })}
      >
        {published ? "Zurückziehen" : "Veröffentlichen"}
      </button>

      <select
        className="field !w-auto !py-2 text-xs"
        value={minTier}
        disabled={pending}
        onChange={(event) => update({ minTier: Number(event.target.value) })}
      >
        <option value={1}>Tier 1 — Starter</option>
        <option value={2}>Tier 2 — Pro</option>
        <option value={3}>Tier 3 — Ultimate</option>
      </select>
    </div>
  );
}

export function FileUploader({ productId }: { productId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");

    if (!(file instanceof File) || file.size === 0) {
      setError("Bitte eine Datei auswählen.");
      return;
    }

    setPending(true);
    setError(null);
    setMessage(null);

    const result = await apiUpload<{ file: { filename: string } }>(
      `/api/admin/products/${productId}/files`,
      data,
    );

    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    setMessage(`${result.data.file.filename} gespeichert und freigeschaltet.`);
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card p-7">
      <p className="eyebrow">Datei hochladen</p>
      <p className="mt-3 text-xs text-[var(--color-muted-2)]">
        Erlaubt: MP3, WAV, MIDI, ZIP, PDF sowie Preset-/Projektdateien. Die Datei wird ausserhalb
        des Web-Roots gespeichert und nur über signierte Links ausgeliefert.
      </p>

      {error && (
        <p className="mt-5 border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>
      )}
      {message && (
        <p className="mt-5 border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </p>
      )}

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="file">Datei</label>
          <input id="file" name="file" type="file" required className="field !py-2.5" />
        </div>
        <div>
          <label className="label" htmlFor="minTierFile">Tier-Override (optional)</label>
          <select id="minTierFile" name="minTier" className="field" defaultValue="">
            <option value="">Vom Produkt übernehmen</option>
            <option value="1">1 — Starter</option>
            <option value="2">2 — Pro</option>
            <option value="3">3 — Ultimate</option>
          </select>
        </div>
      </div>

      <button type="submit" className="btn btn-primary mt-7" disabled={pending}>
        {pending ? "Upload läuft …" : "Hochladen"}
      </button>
    </form>
  );
}

export function DeleteFileButton({ fileId }: { fileId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-muted)] hover:text-red-300"
      disabled={pending}
      onClick={async () => {
        if (!confirm("Datei endgültig löschen?")) return;
        setPending(true);
        await apiSend(`/api/admin/files/${fileId}`, undefined, "DELETE");
        setPending(false);
        router.refresh();
      }}
    >
      {pending ? "…" : "Löschen"}
    </button>
  );
}
