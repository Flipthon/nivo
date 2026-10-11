import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

/** Usado só para iniciar o login OAuth. Dados privados são lidos no servidor. */
export function createClient() {
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
}
