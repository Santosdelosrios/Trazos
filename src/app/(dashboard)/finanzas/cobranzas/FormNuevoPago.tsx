"use client";

import { useState, useTransition } from "react";
import { registrarPago, cargarCreditos, registrarPagoCuentaCorriente } from "@/app/(dashboard)/finanzas/actions";
import { formatearMonto } from "@/lib/finanzas/formatearMonto";
import type { EstadoPago, ModeloCobro } from "@/lib/types/database";
import { MODELO_COBRO_CONFIG } from "@/lib/types/database";
import { Plus, Save, Ticket, BookOpen, Wallet } from "lucide-react";
import FormField, { FIELD_INPUT_CLASS, FIELD_INPUT_CLASS_PLAIN } from "@/components/ui/FormField";

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

export default function FormNuevoPago({ alumnos, tarifaActual }: Props) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [alumnoId, setAlumnoId] = useState("");
  const [monto, setMonto] = useState(tarifaActual);
  const [estado, setEstado] = useState<EstadoPago>("pendiente");
  const [fechaPago, setFechaPago] = useState("");
  const [nota, setNota] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [creditos, setCreditos] = useState(8);

  const selectedAlumno = alumnos.find(a => a.id === alumnoId);
  const modelo = selectedAlumno?.modelo_cobro || "por_clase";
  const modeloConfig = MODELO_COBRO_CONFIG[modelo];

  function resetForm() {
    setAlumnoId("");
    setMonto(tarifaActual);
    setEstado("pendiente");
    setFechaPago("");
    setNota("");
    setPeriodo("");
    setCreditos(8);
    setOpen(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!alumnoId) return;

    startTransition(async () => {
      try {
        switch (modelo) {
          case "por_clase":
            await registrarPago({
              alumno_id: alumnoId,
              monto,
              estado,
              fecha_pago: fechaPago || undefined,
              nota: nota || undefined,
            });
            break;

          case "bolsa_creditos":
            await cargarCreditos({
              alumno_id: alumnoId,
              creditos,
              monto,
              nota: nota || undefined,
            });
            break;

          case "abono_mensual":
            if (!periodo) return;
            await registrarPago({
              alumno_id: alumnoId,
              monto,
              estado,
              fecha_pago: fechaPago || undefined,
              nota: nota || undefined,
              periodo,
            });
            break;

          case "cuenta_corriente":
            await registrarPagoCuentaCorriente({
              alumno_id: alumnoId,
              monto,
              nota: nota || undefined,
            });
            break;
        }
        resetForm();
      } catch (err) {
        console.error("Error al registrar pago:", err);
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

      {/* Alumno selector */}
      <FormField label="Alumno">
        <select
          value={alumnoId}
          onChange={(e) => {
            setAlumnoId(e.target.value);
            const al = alumnos.find((a) => a.id === e.target.value);
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

      {/* Model badge */}
      {alumnoId && (
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${modeloConfig.bg} ${modeloConfig.color}`}>
          <span className="text-base">{modeloConfig.icon}</span>
          {modeloConfig.label}: {modeloConfig.descripcion}
        </div>
      )}

      {/* Conditional fields by model */}
      <div className="grid gap-4 sm:grid-cols-2">

        {modelo === "bolsa_creditos" && (
          <FormField
            label={
              <>
                <Ticket size={12} className="mr-1 inline" />
                Cantidad de créditos (clases)
              </>
            }
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

        {modelo === "abono_mensual" && (
          <FormField
            label={
              <>
                <BookOpen size={12} className="mr-1 inline" />
                Período (mes)
              </>
            }
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
              {modelo === "bolsa_creditos" ? "Monto total del pack ($)" : "Monto ($)"}
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

        {(modelo === "por_clase" || modelo === "abono_mensual") && (
          <FormField label="Estado">
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoPago)}
              className={FIELD_INPUT_CLASS}
            >
              <option value="pendiente">Pendiente</option>
              <option value="pagado">Pagado</option>
              <option value="parcial">Parcial</option>
            </select>
          </FormField>
        )}

        {(modelo === "por_clase" || modelo === "abono_mensual") && (
          <FormField label="Fecha de pago">
            <input
              type="date"
              value={fechaPago}
              onChange={(e) => setFechaPago(e.target.value)}
              className={FIELD_INPUT_CLASS}
            />
          </FormField>
        )}
      </div>

      <FormField label="Nota (opcional)">
        <input
          type="text"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Ej: Pagó por transferencia"
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
