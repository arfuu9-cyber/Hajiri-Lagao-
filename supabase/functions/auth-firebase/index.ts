import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { token, phone } = await req.json()
    
    // Create a Supabase client with the Admin key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Bypass native phone provider check by generating or fetching a user session directly
    const { data: existingUser, error: fetchError } = await supabaseAdmin.auth.admin.listUsers()
    
    let userId = "firebase-user-id"
    const targetPhone = phone || "+919999999999"

    const existing = existingUser?.users?.find(u => u.phone === targetPhone || u.email === `${targetPhone.replace('+', '')}@firebase.auth`)

    if (existing) {
      userId = existing.id
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        phone: targetPhone,
        phone_confirm: true,
        user_metadata: { provider: 'firebase', phone: targetPhone }
      })
      if (newUser?.user) {
        userId = newUser.user.id
      }
    }

    // Generate a custom session token for the user
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: `${targetPhone.replace('+', '')}@firebase.auth`,
    })

    // Alternatively, issue a session token via admin
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.createSession({
      userId: userId
    })

    if (sessionError) {
      throw sessionError
    }

    return new Response(JSON.stringify({ 
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      token_type: "bearer",
      user: sessionData.session.user
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
