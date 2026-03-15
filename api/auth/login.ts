import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client with service role key (for admin operations)
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceKey || 'placeholder-key'
)

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // Only allow POST method
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const { email, password } = request.body

  // Validate input
  if (!email || !password) {
    return response.status(400).json({ error: 'Email and password are required' })
  }

  try {
    // Authenticate with Supabase using the admin client
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return response.status(401).json({ error: error.message })
    }

    // Return user data and session info
    return response.status(200).json({
      user: {
        id: data.user?.id,
        email: data.user?.email,
        created_at: data.user?.created_at,
      },
      session: {
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        expires_in: data.session?.expires_in,
        expires_at: data.session?.expires_at,
      }
    })
  } catch (err: any) {
    console.error('Login error:', err)
    return response.status(500).json({ error: 'Internal server error' })
  }
}