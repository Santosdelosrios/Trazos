import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { MercadoPagoConfig, PreApproval } from "mercadopago";

/**
 * POST /api/suscripcion
 * Crea una suscripción mensual en MercadoPago y devuelve la URL de pago.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Verificar que no sea ya premium
  const { data: maestra } = await supabase
    .from("maestras")
    .select("plan, mp_subscription_id")
    .eq("id", user.id)
    .single();

  if (maestra?.plan === "premium") {
    return NextResponse.json(
      { error: "Ya tenés el plan Premium activo." },
      { status: 400 }
    );
  }

  try {
    const client = new MercadoPagoConfig({
      accessToken: process.env.mp!,
    });

    const preApproval = new PreApproval(client);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://trazosdemaestra.com.ar";

    const result = await preApproval.create({
      body: {
        reason: "Trazos Premium — Suscripción Mensual",
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: 4500,
          currency_id: "ARS",
        },
        payer_email: user.email!,
        back_url: `${baseUrl}/perfil?success=premium`,
        external_reference: user.id,
      },
    });

    // Guardar el ID de suscripción en la base de datos
    if (result.id) {
      await supabase
        .from("maestras")
        .update({ mp_subscription_id: result.id })
        .eq("id", user.id);
    }

    return NextResponse.json({
      init_point: result.init_point,
      id: result.id,
    });
  } catch (error: any) {
    console.error("Error creando suscripción MP:", error);
    return NextResponse.json(
      { error: "Error al crear la suscripción. Intentá de nuevo." },
      { status: 500 }
    );
  }
}
