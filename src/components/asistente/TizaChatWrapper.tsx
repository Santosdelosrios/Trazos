import { createClient } from "@/lib/supabase/server";
import { getPlan } from "@/lib/plan";
import TizaChat from "./TizaChat";

/**
 * Server Component wrapper que solo renderiza TizaChat
 * si el usuario tiene plan Premium.
 */
export default async function TizaChatWrapper() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const plan = await getPlan(supabase, user.id);
  if (plan !== "premium") return null;

  return <TizaChat />;
}
