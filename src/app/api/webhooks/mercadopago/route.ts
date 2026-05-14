import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, PreApproval } from "mercadopago";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/webhooks/mercadopago
 * Maneja notificaciones de MercadoPago sobre cambios en suscripciones.
 *
 * Cuando una suscripción pasa a "authorized", el usuario pasa a Premium.
 * Cuando pasa a "paused" o "cancelled", vuelve a Free.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // MercadoPago envía distintos tipos de notificación
    // Para suscripciones nos interesa type === "subscription_preapproval"
    const { type, data } = body;

    if (type !== "subscription_preapproval" || !data?.id) {
      // Aceptar pero ignorar otros tipos
      return NextResponse.json({ received: true });
    }

    // Consultar el estado actual de la suscripción en MercadoPago
    const client = new MercadoPagoConfig({
      accessToken: process.env.mp!,
    });

    const preApproval = new PreApproval(client);
    const subscription = await preApproval.get({ id: data.id });

    if (!subscription || !subscription.external_reference) {
      console.warn("Webhook MP: suscripción sin external_reference", data.id);
      return NextResponse.json({ received: true });
    }

    const userId = subscription.external_reference;
    const status = subscription.status;

    // Usar el service role para actualizar sin autenticación de usuario
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.supabase!
    );

    if (status === "authorized") {
      // ✅ Pago confirmado → activar Premium por 31 días desde hoy
      // En un flujo perfecto, leeríamos subscription.summarized.next_payment_date
      // pero para evitar fallos si MP no lo manda rápido, sumamos 31 días.
      const premiumUntil = new Date();
      premiumUntil.setDate(premiumUntil.getDate() + 31);

      await supabase
        .from("maestras")
        .update({
          plan: "premium",
          mp_subscription_id: data.id,
          premium_until: premiumUntil.toISOString(),
        })
        .eq("id", userId);

      console.log(`✅ Usuario ${userId} activado como Premium (sub: ${data.id}, hasta: ${premiumUntil.toISOString()})`);
    } else if (status === "paused" || status === "cancelled") {
      // ❌ Suscripción cancelada o pausada. 
      // NO le sacamos el premium inmediatamente, solo borramos el id de sub.
      // La función getPlan() se encargará de bajarlo a Free cuando pase la fecha premium_until.
      await supabase
        .from("maestras")
        .update({ mp_subscription_id: null })
        .eq("id", userId);

      console.log(`⚠️ Usuario ${userId} canceló/pausó (status: ${status}). Mantendrá premium hasta su vencimiento.`);
    }
    // Otros estados (pending, etc.) los ignoramos por ahora

    return NextResponse.json({ received: true, status });
  } catch (error) {
    console.error("Error procesando webhook MP:", error);
    // Siempre retornar 200 para que MP no reintente indefinidamente
    return NextResponse.json({ received: true, error: "internal" });
  }
}

// MercadoPago también puede hacer GET para verificar el endpoint
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
