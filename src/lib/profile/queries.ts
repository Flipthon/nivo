import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;
import { DEFAULT_TIMEZONE, isValidTimeZone } from "@/lib/dates";

export type Profile = {
  id: string;
  display_name: string | null;
  email: string | null;
  timezone: string;
  currency: "BRL";
};

export async function getProfile(supabase: Db, userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, timezone, currency")
    .eq("id", userId)
    .single();

  if (error || !data) throw new Error("Não foi possível carregar seu perfil.");

  return {
    ...data,
    timezone: isValidTimeZone(data.timezone) ? data.timezone : DEFAULT_TIMEZONE,
  } as Profile;
}

export function firstName(profile: Profile): string | null {
  return profile.display_name?.split(/\s+/)[0] ?? null;
}
