"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  X,
  Rocket,
  FileUp,
  Sparkles,
  Target,
  Clock,
  Home,
  Pencil,
  RefreshCw,
  Check,
  Crown,
} from "lucide-react";
import type { AgendaItem, PlanClase } from "@/lib/types/database";
import { MATERIA_LABELS } from "@/lib/types/database";

type Vista = "upload" | "loading" | "plan" | "edit";

export default function PrepararClaseModal({
  item,
  esPremium,
  onClose,
}: {
  item: AgendaItem;
  esPremium: boolean;
  onClose: () => void;
}) {
  const [plan, setPlan] = useState<PlanClase | null>(item.plan_clase ?? null);
  const [vista, setVista] = useState<Vista>(
    item.plan_clase ? "plan" : "upload"
  );
  const [file, setFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const nombre = `${item.alumnos?.nombre ?? ""} ${item.alumnos?.apellido ?? ""}`.trim();

  const handleGenerar = async () => {
    if (!file) return;
    setErrorMsg(null);
    setVista("loading");
    try {
      const fd = new FormData();
      fd.append("agendaId", item.id);
      fd.append("file", file);
      const res = await fetch("/api/preparar-clase", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo preparar la clase.");
      setPlan(data.plan);
      setVista("plan");
    } catch (error: unknown) {
      setErrorMsg((error as Error).message || "No se pudo preparar la clase.");
      setVista("upload");
    }
  };

  const handleGuardarEdicion = async (editado: PlanClase) => {
    setErrorMsg(null);
    try {
      const { guardarPlanClase } = await import("../actions");
      await guardarPlanClase(item.id, editado);
      setPlan(editado);
      setVista("plan");
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2000);
    } catch (error: unknown) {
      setErrorMsg((error as Error).message || "No se pudo guardar.");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-surface-900/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md max-h-[88vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl animate-scale-up border border-surface-100">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
              <Rocket size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-surface-900 leading-tight">
                Preparar con Tiza
              </h2>
              <p className="text-xs font-medium text-surface-500">
                {nombre} · {MATERIA_LABELS[item.materia]}
                {item.tema_previsto ? ` · ${item.tema_previsto}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-700 transition-colors"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl bg-danger-50 p-3 text-sm text-danger-600 border border-danger-100">
            {errorMsg}
          </div>
        )}

        {/* --- Gating premium --- */}
        {!esPremium ? (
          <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
              <Crown size={24} />
            </div>
            <h3 className="text-base font-bold text-amber-900">Función Premium</h3>
            <p className="mt-1 text-sm text-amber-700">
              Tiza prepara la clase a partir de tu material y el historial del alumno.
            </p>
            <Link
              href="/perfil"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-5 py-2.5 text-sm font-bold text-white hover:from-amber-500 hover:to-amber-600 transition-colors shadow-sm"
            >
              <Crown size={16} /> Ser Premium
            </Link>
          </div>
        ) : vista === "upload" ? (
          <UploadView
            file={file}
            onPick={() => inputRef.current?.click()}
            onGenerar={handleGenerar}
          />
        ) : vista === "loading" ? (
          <LoadingView nombre={nombre} />
        ) : vista === "edit" && plan ? (
          <EditView
            plan={plan}
            onCancel={() => setVista("plan")}
            onSave={handleGuardarEdicion}
          />
        ) : plan ? (
          <PlanView
            plan={plan}
            savedOk={savedOk}
            onEditar={() => setVista("edit")}
            onRegenerar={() => {
              setFile(null);
              setVista("upload");
            }}
          />
        ) : null}

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setErrorMsg(null);
            if (f && f.type !== "application/pdf") {
              setErrorMsg("El archivo debe ser un PDF.");
              return;
            }
            setFile(f);
          }}
        />
      </div>
    </div>
  );
}

function UploadView({
  file,
  onPick,
  onGenerar,
}: {
  file: File | null;
  onPick: () => void;
  onGenerar: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-surface-600 leading-relaxed">
        Podés subir el material de la clase (fotocopia, guía, página del libro) para
        que Tiza lo use como base. Si no tenés material, igual arma el plan con el
        historial del alumno.
      </p>

      <button
        onClick={onPick}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-6 text-center transition-colors ${
          file
            ? "border-success-300 bg-success-50"
            : "border-surface-200 bg-surface-50 hover:border-primary-300 hover:bg-primary-50/40"
        }`}
      >
        <FileUp size={24} className={file ? "text-success-600" : "text-surface-400"} />
        <span className="text-sm font-bold text-surface-800">
          {file ? file.name : "Subir un PDF"}
        </span>
        <span className="text-xs text-surface-500">
          {file ? "Tocá para cambiar" : "Opcional · máximo 15MB"}
        </span>
      </button>

      <button
        onClick={onGenerar}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-3.5 text-sm font-black text-white shadow-md hover:from-primary-700 hover:to-primary-800 transition-all active:scale-95"
      >
        <Sparkles size={18} />
        {file ? "Preparar con este material" : "Preparar con el historial"}
      </button>
    </div>
  );
}

function LoadingView({ nombre }: { nombre: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 animate-pulse">
        <Sparkles size={28} />
      </div>
      <div>
        <p className="text-sm font-bold text-surface-800">Tiza está leyendo el material…</p>
        <p className="text-xs text-surface-500 mt-1">
          Armando el plan para la clase con {nombre}.
        </p>
      </div>
    </div>
  );
}

function PlanView({
  plan,
  savedOk,
  onEditar,
  onRegenerar,
}: {
  plan: PlanClase;
  savedOk: boolean;
  onEditar: () => void;
  onRegenerar: () => void;
}) {
  return (
    <div className="space-y-5">
      {savedOk && (
        <div className="flex items-center gap-2 rounded-xl bg-success-50 p-3 text-sm font-medium text-success-700 border border-success-100">
          <Check size={16} /> Plan guardado
        </div>
      )}

      {/* Objetivo */}
      <section className="rounded-2xl bg-primary-50/60 border border-primary-100 p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Target size={16} className="text-primary-600" />
          <h3 className="text-xs font-black uppercase tracking-wider text-primary-700">
            Objetivo
          </h3>
        </div>
        <p className="text-sm text-surface-700 leading-relaxed">{plan.objetivo}</p>
      </section>

      {/* Momentos */}
      <section>
        <div className="flex items-center gap-2 mb-2.5">
          <Clock size={16} className="text-surface-500" />
          <h3 className="text-xs font-black uppercase tracking-wider text-surface-500">
            Momentos
          </h3>
        </div>
        <ol className="space-y-2.5">
          {plan.momentos.map((m, i) => (
            <li
              key={i}
              className="rounded-xl border border-surface-100 bg-white p-3 shadow-sm"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-surface-900">{m.titulo}</span>
                <span className="text-[11px] font-bold text-surface-400">
                  {m.minutos} min
                </span>
              </div>
              <p className="text-sm text-surface-600 leading-relaxed">{m.detalle}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Tarea */}
      <section className="rounded-2xl bg-surface-50 border border-surface-100 p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Home size={16} className="text-surface-500" />
          <h3 className="text-xs font-black uppercase tracking-wider text-surface-500">
            Tarea
          </h3>
        </div>
        <p className="text-sm text-surface-700 leading-relaxed">{plan.tarea}</p>
      </section>

      {/* Acciones */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onEditar}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-surface-50 px-4 py-3 text-sm font-bold text-surface-700 hover:bg-surface-100 transition-all active:scale-95 border border-surface-100"
        >
          <Pencil size={16} /> Editar
        </button>
        <button
          onClick={onRegenerar}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-surface-50 px-4 py-3 text-sm font-bold text-surface-700 hover:bg-surface-100 transition-all active:scale-95 border border-surface-100"
        >
          <RefreshCw size={16} /> Regenerar
        </button>
      </div>
    </div>
  );
}

function EditView({
  plan,
  onCancel,
  onSave,
}: {
  plan: PlanClase;
  onCancel: () => void;
  onSave: (p: PlanClase) => void;
}) {
  const [draft, setDraft] = useState<PlanClase>(plan);
  const [saving, setSaving] = useState(false);

  const updateMomento = (i: number, patch: Partial<PlanClase["momentos"][number]>) => {
    setDraft((d) => ({
      ...d,
      momentos: d.momentos.map((m, idx) => (idx === i ? { ...m, ...patch } : m)),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
  };

  const inputCls =
    "w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/10 transition-all";

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-surface-700 uppercase tracking-wider">
          Objetivo
        </label>
        <textarea
          rows={2}
          value={draft.objetivo}
          onChange={(e) => setDraft({ ...draft, objetivo: e.target.value })}
          className={inputCls}
        />
      </div>

      <div className="space-y-2.5">
        <label className="text-xs font-bold text-surface-700 uppercase tracking-wider">
          Momentos
        </label>
        {draft.momentos.map((m, i) => (
          <div key={i} className="rounded-xl border border-surface-100 p-3 space-y-2">
            <div className="flex gap-2">
              <input
                value={m.titulo}
                onChange={(e) => updateMomento(i, { titulo: e.target.value })}
                className={inputCls}
                placeholder="Título"
              />
              <input
                type="number"
                value={m.minutos}
                onChange={(e) => updateMomento(i, { minutos: Number(e.target.value) })}
                className="w-20 shrink-0 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/10 transition-all"
                placeholder="min"
              />
            </div>
            <textarea
              rows={2}
              value={m.detalle}
              onChange={(e) => updateMomento(i, { detalle: e.target.value })}
              className={inputCls}
              placeholder="Detalle"
            />
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-surface-700 uppercase tracking-wider">
          Tarea
        </label>
        <textarea
          rows={2}
          value={draft.tarea}
          onChange={(e) => setDraft({ ...draft, tarea: e.target.value })}
          className={inputCls}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          disabled={saving}
          className="flex-1 rounded-xl bg-surface-50 px-4 py-3 text-sm font-bold text-surface-600 hover:bg-surface-100 transition-all active:scale-95 border border-surface-100 disabled:opacity-40"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 rounded-xl bg-surface-900 px-4 py-3 text-sm font-bold text-white hover:bg-surface-800 transition-all active:scale-95 disabled:opacity-40"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
