"use client";

import { useState } from "react";
import { actualizarPagoClase } from "../actions";
import { Pencil, X, Check } from "lucide-react";
import type { EstadoPago } from "@/lib/types/database";
import { cn } from "@/lib/utils";

interface PagoEditorProps {
  pago: { monto: number; estado: string } | null;
  claseId: string;
  alumnoId: string;
  claseAlumnoId: string;
}

export default function PagoEditor({ pago, claseId, alumnoId, claseAlumnoId }: PagoEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [monto, setMonto] = useState(pago ? pago.monto.toString() : "");
  const [estado, setEstado] = useState<EstadoPago>((pago?.estado as EstadoPago) || "pendiente");

  const handleSave = async () => {
    if (!monto || isNaN(Number(monto))) return;
    
    setIsSaving(true);
    try {
      await actualizarPagoClase({
        clase_id: claseId,
        alumno_id: alumnoId,
        clase_alumno_id: claseAlumnoId,
        monto: Number(monto),
        estado,
      });
      setIsEditing(false);
    } catch (error) {
      alert("Hubo un error al guardar el pago");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setMonto(pago ? pago.monto.toString() : "");
    setEstado((pago?.estado as EstadoPago) || "pendiente");
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex justify-between items-center border-b border-surface-100 pb-3">
          <span className="text-surface-600 text-sm font-medium">Monto a Cobrar</span>
          <div className="flex items-center gap-2">
            <span className="text-surface-500 font-bold">$</span>
            <input
              type="number"
              min="0"
              step="100"
              required
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-24 rounded-lg border border-primary-200 bg-white px-2 py-1 text-sm font-bold text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-right"
              placeholder="0"
            />
          </div>
        </div>
        
        <div className="flex justify-between items-center pb-3">
          <span className="text-surface-600 text-sm font-medium">Estado del Pago</span>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoPago)}
            className="rounded-lg border border-primary-200 bg-white px-2 py-1 text-sm font-bold text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="pendiente">⏳ Pendiente</option>
            <option value="pagado">✅ Pagado</option>
            <option value="parcial">⚠️ Parcial</option>
            <option value="cancelado">❌ Cancelado</option>
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-1 border-t border-surface-100 mt-2 pt-3">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-surface-500 hover:bg-surface-100 transition-colors disabled:opacity-50"
          >
            <X size={14} /> Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !monto}
            className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-700 transition-all active:scale-95 disabled:opacity-50"
          >
            {isSaving ? "Guardando..." : <><Check size={14} /> Guardar</>}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 group">
      <div className="flex justify-between items-center border-b border-surface-100 pb-3 relative">
        <span className="text-surface-600 text-sm font-medium">Monto a Cobrar</span>
        <div className="flex items-center gap-3">
          <span className="font-bold text-surface-900">{pago ? `$${pago.monto}` : "Sin registrar"}</span>
        </div>
      </div>
      
      <div className="flex justify-between items-center group/row">
        <span className="text-surface-600 text-sm font-medium">Estado del Pago</span>
        <div className="flex items-center gap-2">
          {!pago ? (
            <span className="text-xs font-bold text-surface-500 bg-surface-100 px-2.5 py-1 rounded-lg">
              No registrado
            </span>
          ) : pago.estado === "pagado" ? (
            <span className="text-xs font-bold text-success-700 bg-success-100 px-2.5 py-1 rounded-lg">
              ✅ Pagado
            </span>
          ) : pago.estado === "parcial" ? (
            <span className="text-xs font-bold text-warning-700 bg-warning-100 px-2.5 py-1 rounded-lg">
              ⚠️ Parcial
            </span>
          ) : pago.estado === "cancelado" ? (
            <span className="text-xs font-bold text-surface-500 bg-surface-100 px-2.5 py-1 rounded-lg">
              ❌ Cancelado
            </span>
          ) : (
            <span className="text-xs font-bold text-warning-700 bg-warning-100 px-2.5 py-1 rounded-lg">
              ⏳ Pendiente
            </span>
          )}
          
          <button
            onClick={() => setIsEditing(true)}
            className="rounded-lg p-1.5 text-primary-600 bg-primary-50 border border-primary-100 transition-all hover:bg-primary-100 hover:scale-105 active:scale-95"
            title="Editar pago"
          >
            <Pencil size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
