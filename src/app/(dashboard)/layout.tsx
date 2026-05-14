import { Suspense } from "react";
import DashboardLayoutWrapper from "@/components/layout/DashboardLayoutWrapper";
import TizaChatWrapper from "@/components/asistente/TizaChatWrapper";
import { createClient } from "@/lib/supabase/server";
import { getPlan } from "@/lib/plan";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const plan = user ? await getPlan(supabase, user.id) : "free";

  return (
    <DashboardLayoutWrapper plan={plan}>
      {children}
      <Suspense fallback={null}>
        <TizaChatWrapper />
      </Suspense>
    </DashboardLayoutWrapper>
  );
}
