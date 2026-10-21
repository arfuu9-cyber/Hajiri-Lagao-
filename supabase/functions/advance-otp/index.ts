import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SupabaseClient {
  from: (table: string) => any;
  auth: {
    getUser: (token: string) => Promise<{ data: { user: { id: string } | null }; error: any }>;
  };
}

function getSupabaseClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceKey, { auth: { persistSession: false } }) as unknown as SupabaseClient;
}

function generateOtp(): string {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(100000 + (values[0] % 900000));
}

function maskPhone(phone: string): string {
  if (phone.length < 4) return phone;
  return phone.slice(0, 2) + "****" + phone.slice(-2);
}

function developmentOtpAllowed(): boolean {
  // Never expose an OTP in a production deployment, even if DENO_ENV is misconfigured.
  return Deno.env.get("ALLOW_DEV_OTP") === "true" && Deno.env.get("DENO_ENV") !== "production";
}

function workerFromAdvance(advance: any): any | null {
  const relation = advance?.worker;
  return Array.isArray(relation) ? (relation[0] ?? null) : (relation ?? null);
}

async function canUserAccessAdvance(supabase: any, advance: any, userId: string): Promise<boolean> {
  const worker = workerFromAdvance(advance);
  if (!worker) return false;
  if (worker.user_id === userId) return true;
  if (!worker.thekedar_id) return false;

  // A worker's thekedar_id points to the thekedar's own worker record.
  const { data, error } = await supabase
    .from("workers")
    .select("id")
    .eq("id", worker.thekedar_id)
    .eq("user_id", userId)
    .maybeSingle();
  return !error && Boolean(data);
}

function otpUnavailableResponse(): Response {
  return new Response(
    JSON.stringify({ error: "OTP delivery is not configured. For local testing, explicitly set ALLOW_DEV_OTP=true and ensure DENO_ENV is not production; before launch, connect an SMS provider." }),
    { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const { action, advanceId, otpCode } = body;

    if (action === "send_otp") {
      // Fetch the advance record with worker's phone
      const { data: advance, error: advanceError } = await supabase
        .from("advances")
        .select(`
          id,
          amount,
          status,
          otp_code,
          otp_expires_at,
          worker:workers ( id, name, phone, user_id, thekedar_id )
        `)
        .eq("id", advanceId)
        .single();

      if (advanceError || !advance) {
        return new Response(
          JSON.stringify({ error: "Advance not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!(await canUserAccessAdvance(supabase, advance, authData.user.id))) {
        return new Response(
          JSON.stringify({ error: "You do not have permission to verify this advance" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (advance.status === "verified") {
        return new Response(
          JSON.stringify({ error: "Already verified" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const workerPhone = advance.worker?.phone;
      if (!workerPhone) {
        return new Response(
          JSON.stringify({ error: "Worker phone number not available" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!developmentOtpAllowed()) return otpUnavailableResponse();
      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error: updateError } = await supabase
        .from("advances")
        .update({
          otp_code: otp,
          otp_expires_at: expiresAt,
        })
        .eq("id", advanceId);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Could not generate OTP" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await supabase
        .from("advance_verifications")
        .insert({
          advance_id: advanceId,
          attempt_type: "otp_sent",
          phone_used: workerPhone,
        });

      // In production, send SMS here via provider (MSG91, Twilio, etc.)
      // For now, return OTP in response for dev/testing
      const isDev = developmentOtpAllowed();

      return new Response(
        JSON.stringify({
          success: true,
          maskedPhone: maskPhone(workerPhone),
          ...(isDev ? { devOtp: otp } : {}),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "verify_otp") {
      const { data: advance, error: advanceError } = await supabase
        .from("advances")
        .select("id, status, otp_code, otp_expires_at, worker:workers(phone, user_id, thekedar_id)")
        .eq("id", advanceId)
        .single();

      if (advanceError || !advance) {
        return new Response(
          JSON.stringify({ error: "Advance not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!(await canUserAccessAdvance(supabase, advance, authData.user.id))) {
        return new Response(
          JSON.stringify({ error: "You do not have permission to verify this advance" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (advance.status === "verified") {
        return new Response(
          JSON.stringify({ error: "Already verified" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!advance.otp_code || !advance.otp_expires_at) {
        return new Response(
          JSON.stringify({ error: "No OTP sent. Please request OTP first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (new Date() > new Date(advance.otp_expires_at)) {
        return new Response(
          JSON.stringify({ error: "OTP expired. Please request a new OTP." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { count: recentFailures } = await supabase
        .from("advance_verifications")
        .select("id", { count: "exact", head: true })
        .eq("advance_id", advanceId)
        .eq("attempt_type", "otp_failed")
        .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());
      if ((recentFailures ?? 0) >= 5) {
        return new Response(
          JSON.stringify({ error: "Too many wrong OTP attempts. Request a new OTP later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (String(advance.otp_code).trim() !== String(otpCode).trim()) {
        await supabase
          .from("advance_verifications")
          .insert({
            advance_id: advanceId,
            attempt_type: "otp_failed",
            phone_used: advance.worker?.phone ?? null,
          });

        return new Response(
          JSON.stringify({ error: "Galat OTP. Dobara try karo." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { error: verifyError } = await supabase
        .from("advances")
        .update({
          status: "verified",
          verified_at: new Date().toISOString(),
          otp_code: null,
          otp_expires_at: null,
        })
        .eq("id", advanceId);

      if (verifyError) {
        return new Response(
          JSON.stringify({ error: "Could not verify advance" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await supabase
        .from("advance_verifications")
        .insert({
          advance_id: advanceId,
          attempt_type: "otp_verified",
          phone_used: advance.worker?.phone ?? null,
        });

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "resend_otp") {
      const { data: advance, error: advanceError } = await supabase
        .from("advances")
        .select("id, status, worker:workers(phone, user_id, thekedar_id)")
        .eq("id", advanceId)
        .single();

      if (advanceError || !advance) {
        return new Response(
          JSON.stringify({ error: "Advance not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!(await canUserAccessAdvance(supabase, advance, authData.user.id))) {
        return new Response(
          JSON.stringify({ error: "You do not have permission to verify this advance" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (advance.status === "verified") {
        return new Response(
          JSON.stringify({ error: "Already verified" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const workerPhone = advance.worker?.phone;
      if (!workerPhone) {
        return new Response(
          JSON.stringify({ error: "Worker phone number not available" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!developmentOtpAllowed()) return otpUnavailableResponse();
      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await supabase
        .from("advances")
        .update({ otp_code: otp, otp_expires_at: expiresAt })
        .eq("id", advanceId);

      await supabase
        .from("advance_verifications")
        .insert({
          advance_id: advanceId,
          attempt_type: "otp_resent",
          phone_used: workerPhone,
        });

      const isDev = developmentOtpAllowed();

      return new Response(
        JSON.stringify({
          success: true,
          maskedPhone: maskPhone(workerPhone),
          ...(isDev ? { devOtp: otp } : {}),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use send_otp, verify_otp, or resend_otp." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}

Deno.serve(handler);
