// Client management module
// Handles CRUD operations for saved clients via Supabase

import type { ClientInfo } from './types'
import { supabase, clientsDb, getCurrentUser } from './supabase'

// Client with ID (from Supabase)
export interface SavedClient extends ClientInfo {
  id: string
  user_id: string
  created_at: string
  updated_at: string
}

// Get all saved clients for current user
export async function getClients(): Promise<SavedClient[]> {
  const user = getCurrentUser()
  if (!user) {
    console.warn('No user logged in, returning empty array')
    return []
  }
  
  try {
    const clients = await clientsDb.getAll(user.id)
    return clients as SavedClient[]
  } catch (error) {
    console.error('Failed to load clients:', error)
    return []
  }
}

// Save a new client
export async function addClient(client: Omit<SavedClient, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<SavedClient | null> {
  const user = getCurrentUser()
  if (!user) {
    console.error('User not logged in')
    return null
  }
  
  try {
    const newClient = await clientsDb.create({
      ...client,
      user_id: user.id
    })
    return newClient as SavedClient
  } catch (error) {
    console.error('Failed to add client:', error)
    return null
  }
}

// Update an existing client
export async function updateClient(id: string, updates: Partial<Omit<SavedClient, 'id' | 'user_id' | 'created_at'>>): Promise<SavedClient | null> {
  try {
    const updated = await clientsDb.update(id, {
      ...updates,
      updated_at: new Date().toISOString()
    })
    return updated as SavedClient
  } catch (error) {
    console.error('Failed to update client:', error)
    return null
  }
}

// Delete a client
export async function deleteClient(id: string): Promise<boolean> {
  try {
    await clientsDb.delete(id)
    return true
  } catch (error) {
    console.error('Failed to delete client:', error)
    return false
  }
}

// Get a single client by ID
export async function getClient(id: string): Promise<SavedClient | null> {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data as SavedClient
  } catch (error) {
    console.error('Failed to get client:', error)
    return null
  }
}

// Create client dropdown HTML
export async function renderClientSelector(selectedId?: string): Promise<string> {
  const clients = await getClients()
  
  if (clients.length === 0) {
    return '<option value="">-- No saved clients --</option>'
  }
  
  const options = clients.map(client => 
    `<option value="${client.id}" ${client.id === selectedId ? 'selected' : ''}>${client.name}</option>`
  ).join('')
  
  return `
    <option value="">-- Select a saved client --</option>
    ${options}
  `
}

// Get client info as ClientInfo (for use in InvoiceData)
export async function getClientForInvoice(id: string): Promise<ClientInfo | null> {
  const client = await getClient(id)
  if (!client) return null
  
  return {
    name: client.name,
    email: client.email,
    address: client.address
  }
}

// Render client list for management UI
export async function renderClientList(): Promise<string> {
  const clients = await getClients()
  
  if (clients.length === 0) {
    return '<p class="empty-state">No saved clients yet. Add your first client!</p>'
  }
  
  return clients.map(client => `
    <div class="client-card" data-id="${client.id}">
      <div class="client-info">
        <h4>${client.name}</h4>
        <p>${client.email || 'No email'}</p>
        <p class="client-address">${client.address || 'No address'}</p>
      </div>
      <div class="client-actions">
        <button class="btn btn-sm btn-outline" data-action="edit" data-id="${client.id}">Edit</button>
        <button class="btn btn-sm btn-ghost" data-action="delete" data-id="${client.id}">Delete</button>
      </div>
    </div>
  `).join('')
}

// Render add/edit client form
export function renderClientForm(client?: SavedClient): string {
  return `
    <form class="client-form" id="client-form">
      <div class="form-group">
        <label class="form-label required">Client Name</label>
        <input type="text" class="form-input" name="name" value="${client?.name || ''}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" class="form-input" name="email" value="${client?.email || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Address</label>
        <textarea class="form-input" name="address">${client?.address || ''}</textarea>
      </div>
      <input type="hidden" name="id" value="${client?.id || ''}">
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" id="cancel-client-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">${client ? 'Update Client' : 'Add Client'}</button>
      </div>
    </form>
  `
}