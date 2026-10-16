import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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
    const { phone } = await req.json()
    if (!phone) {
      throw new Error('Phone number is required')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const targetPhone = phone
    const email = `${targetPhone.replace('+', '')}@firebase.auth`
    const tempPassword = crypto.randomUUID() + Math.random().toString(36)

    // Check if user exists
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) throw listError

    let existingUser = users.find(u => u.phone === targetPhone || u.email === email)
    let userId = existingUser?.id

    if (!userId) {
      // Create user if not exists
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        phone: targetPhone,
        email: email,
        password: tempPassword,
        phone_confirm: true,
        email_confirm: true,
        user_metadata: { provider: 'firebase', phone: targetPhone }
      })
      if (createError) throw createError
      userId = newUser.user.id
    } else {
      // Update password for existing user to sign in
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: tempPassword
      })
      if (updateError) throw updateError
    }

    // Sign in to get a valid session
    const supabaseAnon = createClient(supabaseUrl, anonKey)
    const { data: sessionData, error: sessionError } = await supabaseAnon.auth.signInWithPassword({
      email: email,
      password: tempPassword,
    })

    if (sessionError) throw sessionError

    return new Response(JSON.stringify({
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      user: sessionData.user
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
