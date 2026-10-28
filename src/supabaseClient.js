import { createClient } from "@supabase/supabase-js";

const projectUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const publicKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// A single client keeps account sign-in and the optional store on the same
// Supabase session. Only the public browser key belongs in this file.
export const supabaseClient = projectUrl && publicKey
  ? createClient(projectUrl, publicKey)
  : null;

export const paymentsEnabled = import.meta.env.VITE_PAYMENTS_ENABLED === "true";
