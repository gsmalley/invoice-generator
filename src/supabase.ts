// Supabase client module
// Handles connection to Supabase backend

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate that we have the required environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables!')
}

// Create and export the Supabase client
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
)

// Auth state types
export interface User {
  id: string
  email: string
  created_at: string
}

export interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

// Current auth state (reactive in real app, simple version here)
let currentAuthState: AuthState = {
  user: null,
  loading: true,
  error: null
}

// Auth change callback
let authChangeCallback: ((user: User | null) => void) | null = null

export function onAuthChange(callback: (user: User | null) => void) {
  authChangeCallback = callback
}

// Auth functions
export async function signUp(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    return { user: null, error: error.message }
  }

  return { user: data.user as User | null, error: null }
}

export async function signIn(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { user: null, error: error.message }
  }

  return { user: data.user as User | null, error: null }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
  currentAuthState = { user: null, loading: false, error: null }
}

export function getCurrentUser(): User | null {
  return currentAuthState.user
}

export function isAuthenticated(): boolean {
  return currentAuthState.user !== null
}

// Get the current auth state
export function getAuthState(): AuthState {
  return { ...currentAuthState }
}

// Initialize auth state listener
export function initAuth(): Promise<User | null> {
  return new Promise((resolve) => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Error getting session:', error)
        currentAuthState = { user: null, loading: false, error: error.message }
        resolve(null)
        return
      }

      if (session?.user) {
        currentAuthState = { user: session.user as User, loading: false, error: null }
        resolve(session.user as User)
      } else {
        currentAuthState = { user: null, loading: false, error: null }
        resolve(null)
      }
    })

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        currentAuthState = { user: session.user as User, loading: false, error: null }
      } else {
        currentAuthState = { user: null, loading: false, error: null }
      }
      // Notify UI of auth change
      if (authChangeCallback) {
        authChangeCallback(currentAuthState.user)
      }
    })
  })
}

// Database operations for invoices
export const invoicesDb = {
  async getAll(businessId?: string) {
    let query = supabase.from('invoices').select('*').order('created_at', { ascending: false })
    if (businessId) {
      query = query.eq('business_id', businessId)
    }
    const { data, error } = await query
    if (error) throw error
    return data
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },

  async create(invoice: any) {
    const { data, error } = await supabase.from('invoices').insert(invoice).select().single()
    if (error) throw error
    return data
  },

  async update(id: string, updates: any) {
    const { data, error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async delete(id: string) {
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) throw error
  }
}

// Database operations for clients
export const clientsDb = {
  async getAll(userId: string) {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  async create(client: any) {
    const { data, error } = await supabase.from('clients').insert(client).select().single()
    if (error) throw error
    return data
  },

  async update(id: string, updates: any) {
    const { data, error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async delete(id: string) {
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) throw error
  }
}

// Database operations for businesses
export const businessesDb = {
  async getAll(userId: string) {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  async create(business: any) {
    const { data, error } = await supabase.from('businesses').insert(business).select().single()
    if (error) throw error
    return data
  },

  async update(id: string, updates: any) {
    const { data, error } = await supabase
      .from('businesses')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async delete(id: string) {
    const { error } = await supabase.from('businesses').delete().eq('id', id)
    if (error) throw error
  }
}