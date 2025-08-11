import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

let cachedSupabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  // Avoid reading env at module load time; dotenv in index.ts runs later
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  if (cachedSupabaseClient) {
    return cachedSupabaseClient;
  }

  try {
    cachedSupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return cachedSupabaseClient;
  } catch (err) {
    console.warn(
      "Failed to initialize Supabase client. Falling back to env-only tokens.",
      err
    );
    return null;
  }
}

export type TokenRequirements = {
  required: ReadonlyArray<string>;
  envMap?: Record<string, string>; // tokenKey -> ENV_VAR_NAME
};

export async function getUserTokens<
  TTokens extends Record<string, unknown> = Record<string, unknown>
>(
  userId: string,
  provider: string,
  requirements?: TokenRequirements
): Promise<{ tokens: TTokens; env: Record<string, string> }> {
  // Attempt to fetch from Supabase if configured. Otherwise, fall back to env-only.
  let data: Record<string, unknown> | null = null;
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data: row, error } = await supabase
        .from("user_connections")
        .select("access_token, refresh_token, expires_at")
        .eq("user_id", userId)
        .eq("provider", provider)
        .single();

      if (error) {
        console.warn(
          `Supabase query failed for provider '${provider}'. Falling back to env-only tokens.`,
          error
        );
      } else {
        data = row ?? null;
      }
    } else {
      // Not configured; skip querying
      console.warn(
        "Supabase is not configured (missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY). Using env-only tokens."
      );
    }
  } catch (err) {
    console.warn(
      `Unexpected error while fetching credentials from Supabase for provider '${provider}'. Using env-only tokens.`,
      err
    );
  }

  const mergedTokens: Record<string, unknown> = {
    ...(data ?? {}),
  };

  // Fallback: fill missing token fields from environment variables using envMap
  if (requirements?.envMap) {
    for (const [tokenKey, envName] of Object.entries(requirements.envMap)) {
      const current = mergedTokens[tokenKey];
      const isMissing =
        current === undefined ||
        current === null ||
        (typeof current === "string" && current.trim() === "");
      if (isMissing) {
        const envValue = process.env[envName];
        if (
          envValue !== undefined &&
          envValue !== null &&
          String(envValue).trim() !== ""
        ) {
          mergedTokens[tokenKey] = envValue;
        }
      }
    }
  }

  // console.log("mergedTokens: ", mergedTokens);

  // Validate required keys exist and are non-empty
  if (requirements?.required?.length) {
    const missing = requirements.required.filter((key) => {
      const value = mergedTokens[key];
      return (
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim() === "")
      );
    });
    if (missing.length > 0) {
      // If Supabase is unavailable, keep error message but clarify fallback context
      throw new Error(
        `Missing required credentials for provider '${provider}': ${missing.join(
          ", "
        )}. Ensure they are present in Supabase or provided via environment variables as configured.`
      );
    }
  }

  // Build ENV map for MCP process
  const env: Record<string, string> = {};
  if (requirements?.envMap) {
    for (const [tokenKey, envName] of Object.entries(requirements.envMap)) {
      const value = mergedTokens[tokenKey];
      if (value !== undefined && value !== null) {
        env[envName] = String(value);
      }
    }
  }

  return { tokens: mergedTokens as TTokens, env };
}
