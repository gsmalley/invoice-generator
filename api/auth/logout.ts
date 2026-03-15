import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

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

  // Get the access token from the request headers or body
  const authHeader = request.headers.authorization
  const accessToken = authHeader?.replace('Bearer ', '') || request.body?.access_token

  if (!accessToken) {
    return response.status(400).json({ error: 'Access token is required' })
  }

  try {
    // Sign out the user using the token
    const { error } = await supabase.auth.signOut(accessToken)

    if (error) {
      return response.status(401).json({ error: error.message })
    }

    return response.status(200).json({ message: 'Logged out successfully' })
  } catch (err: any) {
    console.error('Logout error:', err)
    return response.status(500).json({ error: 'Internal server error' })
  }
}