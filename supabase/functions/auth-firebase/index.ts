import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SupabaseServiceClient {
  auth: {
    admin: {
      createUser: (opts: Record<string, unknown>) => Promise<{ data: any; error: any }>;
      generateLink: (opts: Record<string, unknown>) => Promise<{ data: any; error: any }>;
    };
    signInWithPassword: (creds: Record<string, unknown>) => Promise<{ data: any; error: any }>;
  };
}

function getClient(): SupabaseServiceClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as SupabaseServiceClient;
}

// Verify Firebase ID token using Firebase's REST API
// https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
async function verifyFirebaseToken(idToken: string, projectId: string): Promise<{ phone: string | null; uid: string } | null> {
  try {
    // Use Google's public keys to verify the JWT
    const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${Deno.env.get("FIREBASE_API_KEY")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    if (!resp.ok) {
      console.error("[Firebase] token verification failed:", resp.status, await resp.text());
      return null;
    }

    const data = await resp.json();

    if (!data.users || data.users.length === 0) {
      return null;
    }

    const user = data.users[0];
    return {
      uid: user.localId,
      phone: user.phoneNumber ?? null,
    };
  } catch (err) {
    console.error("[Firebase] verify error:", err instanceof Error ? err.message : err);
    return null;
  }
}

function formatPhone(phone: string): string {
  const trimmed = phone.trim().replace(/\s+/g, "");
  if (trimmed.startsWith("+")) return trimmed;
  if (trimmed.startsWith("91")) return `+${trimmed}`;
  return `+91${trimmed.replace(/^0+/, "")}`;
}

async function getStablePassword(phone: string): Promise<string> {
  const data = new TextEncoder().encode(
    `firebase:${phone}:${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.slice(-32)}`,
  );
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getOrCreateSession(
  supabase: SupabaseServiceClient,
  phone: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number; user: { id: string; phone: string } } | null> {
  const stablePassword = await getStablePassword(phone);

  // Try sign in first (existing user)
  const signInResult = await supabase.auth.signInWithPassword({
    phone,
    password: stablePassword,
  });

  if (signInResult.data?.user && !signInResult.error) {
    return signInResult.data;
  }

  // User doesn't exist — create with phone confirmed
  const createResult = await supabase.auth.admin.createUser({
    phone,
    password: stablePassword,
    phone_confirm: true,
  });

  if (createResult.error || !createResult.data?.user) {
    console.error("[Auth] create user error:", createResult.error);
    return null;
  }

  // Sign in with the newly created user
  const newSignIn = await supabase.auth.signInWithPassword({
    phone,
    password: stablePassword,
  });

  if (newSignIn.data?.user && !newSignIn.error) {
    return newSignIn.data;
  }

  console.error("[Auth] sign in after create error:", newSignIn.error);
  return null;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { firebaseIdToken } = body;

    if (!firebaseIdToken) {
      return new Response(
        JSON.stringify({ error: "Firebase ID token missing." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const projectId = Deno.env.get("FIREBASE_PROJECT_ID") ?? "";
    const firebaseUser = await verifyFirebaseToken(firebaseIdToken, projectId);

    if (!firebaseUser || !firebaseUser.phone) {
      return new Response(
        JSON.stringify({ error: "Firebase token verify nahi hua. Dobara try karo." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const formattedPhone = formatPhone(firebaseUser.phone);
    const supabase = getClient();
    const session = await getOrCreateSession(supabase, formattedPhone);

    if (!session) {
      return new Response(
        JSON.stringify({ error: "Supabase login nahi ho saka. Dobara try karo." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
          user: {
            id: session.user.id,
            phone: session.user.phone,
          },
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}

Deno.serve(handler);
