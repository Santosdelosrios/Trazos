"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { formatearMonto } from "@/lib/finanzas/formatearMonto";

interface DataPoint {
  mes: string;       // "may '26"
  ingresos: number;
  gastos: number;
  neto: number;
}

interface Props {
  data: DataPoint[];
}

/**
 * Gráfico combinado: barras stackeadas para ingresos (verde) y gastos
 * (rojo), línea para neto. Recharts viene via dynamic import en el
 * componente padre — este archivo se carga solo cuando hace falta.
 */
export default function GraficoHistorico({ data }: Props) {
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 8, left: 0 }}
        >
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="mes"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
          />
          <YAxis
            tickFormatter={(v) => v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`}
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
            width={56}
          />
          <Tooltip
            formatter={(value) => formatearMonto(Number(value) || 0)}
            labelStyle={{ fontWeight: 700, color: "#1f2937" }}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              fontSize: 12,
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />
          <Bar dataKey="ingresos" fill="#22c55e" name="Ingresos" radius={[4, 4, 0, 0]} />
          <Bar dataKey="gastos"   fill="#f87171" name="Gastos"   radius={[4, 4, 0, 0]} />
          <Line
            type="monotone"
            dataKey="neto"
            stroke="#6366f1"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#6366f1" }}
            name="Neto"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
