"use client";

import { useState, useTransition } from "react";
import { registrarCobro } from "@/app/(dashboard)/finanzas/actions";
import { formatearMonto } from "@/lib/finanzas/formatearMonto";
import type { MedioPago, ModeloCobro } from "@/lib/types/database";
import { MODELO_COBRO_CONFIG } from "@/lib/types/database";
import { Plus, Save, Ticket, Wallet, BookOpen } from "lucide-react";
import FormField, { FIELD_INPUT_CLASS, FIELD_INPUT_CLASS_PLAIN } from "@/components/ui/FormField";
import { useToast } from "@/components/ui/Toast";

interface AlumnoOption {
  id: string;
  nombre: string;
  apellido: string;
  modelo_cobro: ModeloCobro;
}

interface Props {
  alumnos: AlumnoOption[];
  tarifaActual: number;
}

/**
 * Form unificado para registrar un cobro recibido.
 *
 * Antes había un switch por modelo (registrarPago / cargarCreditos /
 * registrarPagoCuentaCorriente). Ahora es UN solo action y un solo
 * form. Lo único que varía por modelo son campos extras opcionales:
 *
 *   - bolsa_creditos: aparece "créditos a otorgar" (origen=pack)
 *   - abono_mensual:  aparece "período" (informativo en la nota)
 */
export default function FormNuevoPago({ alumnos, tarifaActual }: Props) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [alumnoId, setAlumnoId] = useState("");
  const [monto, setMonto] = useState(tarifaActual);
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [medioPago, setMedioPago] = useState<MedioPago | "">("");
  const [nota, setNota] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [creditos, setCreditos] = useState(8);

  const selectedAlumno = alumnos.find((a) => a.id === alumnoId);
  const modelo: ModeloCobro = selectedAlumno?.modelo_cobro || "por_clase";
  const modeloConfig = MODELO_COBRO_CONFIG[modelo];
  const esPack = modelo === "bolsa_creditos";
  const esAbono = modelo === "abono_mensual";
  const toast = useToast();

  function resetForm() {
    setAlumnoId("");
    setMonto(tarifaActual);
    setFecha(new Date().toISOString().split("T")[0]);
    setMedioPago("");
    setNota("");
    setPeriodo("");
    setCreditos(8);
    setOpen(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!alumnoId) return;
    if (esAbono && !periodo) {
      toast.error("Indicá el período del abono.");
      return;
    }

    startTransition(async () => {
      try {
        await registrarCobro({
          alumno_id: alumnoId,
          monto,
          fecha,
          medio_pago: medioPago || undefined,
          nota: nota || (esAbono ? `Abono ${periodo}` : undefined),
          creditos_otorgados: esPack ? creditos : 0,
          origen: esPack ? "pack" : "manual",
        });
        toast.success(
          esPack
            ? `Pack de ${creditos} créditos cargado por ${formatearMonto(monto)}`
            : `Cobro registrado por ${formatearMonto(monto)}`
        );
        resetForm();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "No se pudo registrar el cobro";
        toast.error(msg);
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-3 text-sm font-bold text-white shadow-md hover:from-primary-700 hover:to-primary-800 transition-all active:scale-[0.98]"
      >
        <Plus size={16} /> Nuevo Cobro
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-primary-200 bg-white p-6 shadow-sm animate-fade-in-up space-y-4"
    >
      <h3 className="text-base font-bold text-surface-900">Registrar Cobro</h3>

      <FormField label="Alumno">
        <select
          value={alumnoId}
          onChange={(e) => {
            const id = e.target.value;
            setAlumnoId(id);
            const al = alumnos.find((a) => a.id === id);
            if (al?.modelo_cobro === "bolsa_creditos") {
              setMonto(tarifaActual * 8);
              setCreditos(8);
            } else {
              setMonto(tarifaActual);
            }
          }}
          required
          className={FIELD_INPUT_CLASS}
        >
          <option value="">Seleccionar alumno...</option>
          {alumnos.map((a) => (
            <option key={a.id} value={a.id}>
              {a.apellido}, {a.nombre} — {MODELO_COBRO_CONFIG[a.modelo_cobro].icon}{" "}
              {MODELO_COBRO_CONFIG[a.modelo_cobro].label}
            </option>
          ))}
        </select>
      </FormField>

      {alumnoId && (
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${modeloConfig.bg} ${modeloConfig.color}`}>
          <span className="text-base">{modeloConfig.icon}</span>
          {modeloConfig.label}: {modeloConfig.descripcion}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {esPack && (
          <FormField
            label={<><Ticket size={12} className="mr-1 inline" /> Créditos (clases)</>}
          >
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={1}
              max={100}
              value={creditos}
              onChange={(e) => {
                const c = Number(e.target.value);
                setCreditos(c);
                setMonto(c * tarifaActual);
              }}
              required
              className={FIELD_INPUT_CLASS}
            />
          </FormField>
        )}

        {esAbono && (
          <FormField
            label={<><BookOpen size={12} className="mr-1 inline" /> Período (mes)</>}
          >
            <input
              type="month"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              required
              className={FIELD_INPUT_CLASS}
            />
          </FormField>
        )}

        <FormField
          label={
            <>
              <Wallet size={12} className="mr-1 inline" />
              {esPack ? "Monto total del pack ($)" : "Monto ($)"}
            </>
          }
          hint={
            tarifaActual > 0 && modelo === "por_clase"
              ? `Tarifa vigente: ${formatearMonto(tarifaActual)}`
              : undefined
          }
        >
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            min={0}
            step={100}
            value={monto}
            onChange={(e) => setMonto(Number(e.target.value))}
            required
            className={FIELD_INPUT_CLASS}
          />
        </FormField>

        <FormField label="Fecha del cobro">
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
            className={FIELD_INPUT_CLASS}
          />
        </FormField>

        <FormField label="Medio de pago">
          <select
            value={medioPago}
            onChange={(e) => setMedioPago(e.target.value as MedioPago | "")}
            className={FIELD_INPUT_CLASS}
          >
            <option value="">Sin especificar</option>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="mercadopago">Mercado Pago</option>
            <option value="otro">Otro</option>
          </select>
        </FormField>
      </div>

      <FormField label="Nota (opcional)">
        <input
          type="text"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Ej: Pagó hasta marzo"
          className={FIELD_INPUT_CLASS_PLAIN}
        />
      </FormField>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 rounded-xl bg-surface-900 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary-600 transition-all active:scale-95 disabled:opacity-50"
        >
          {isPending ? "Guardando..." : <><Save size={16} /> Guardar Cobro</>}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl bg-surface-100 px-4 py-2.5 text-sm font-semibold text-surface-700 hover:bg-surface-200 transition-all"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
