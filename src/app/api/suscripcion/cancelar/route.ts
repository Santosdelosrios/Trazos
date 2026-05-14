import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { MercadoPagoConfig, PreApproval } from "mercadopago";

/**
 * POST /api/suscripcion/cancelar
 * Cancela la suscripción activa en MercadoPago.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Obtener el ID de suscripción de la base de datos
  const { data: maestra } = await supabase
    .from("maestras")
    .select("mp_subscription_id, plan")
    .eq("id", user.id)
    .single();

  if (!maestra?.mp_subscription_id || maestra.plan !== "premium") {
    return NextResponse.json(
      { error: "No tenés una suscripción activa para cancelar." },
      { status: 400 }
    );
  }

  try {
    const client = new MercadoPagoConfig({
      accessToken: process.env.mp!,
    });

    const preApproval = new PreApproval(client);

    // Cancelar en MercadoPago
    await preApproval.update({
      id: maestra.mp_subscription_id,
      body: {
        status: "cancelled",
      },
    });

    // Actualizar localmente para borrar el id de sub, pero mantener el plan premium hasta su fin.
    await supabase
      .from("maestras")
      .update({ mp_subscription_id: null })
      .eq("id", user.id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error cancelando suscripción MP:", error);
    return NextResponse.json(
      { error: "Error al cancelar la suscripción. Intentá de nuevo o contactanos." },
      { status: 500 }
    );
  }
}
