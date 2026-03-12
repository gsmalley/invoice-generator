// Client management module
// Handles CRUD operations for saved clients

import type { ClientInfo } from './types'

// Storage key
const CLIENTS_STORAGE_KEY = 'saved_clients'

// Client with ID
export interface SavedClient extends ClientInfo {
  id: string
  createdAt: number
  updatedAt: number
}

// Get all saved clients
export function getClients(): SavedClient[] {
  try {
    const stored = localStorage.getItem(CLIENTS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Failed to load clients:', error)
    return []
  }
}

// Generate unique ID
function generateId(): string {
  return 'client_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

// Save a new client
export function addClient(client: Omit<SavedClient, 'id' | 'createdAt' | 'updatedAt'>): SavedClient {
  const clients = getClients()
  
  const newClient: SavedClient = {
    ...client,
    id: generateId(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  
  clients.push(newClient)
  saveClients(clients)
  
  return newClient
}

// Update an existing client
export function updateClient(id: string, updates: Partial<Omit<SavedClient, 'id' | 'createdAt'>>): SavedClient | null {
  const clients = getClients()
  const index = clients.findIndex(c => c.id === id)
  
  if (index === -1) return null
  
  clients[index] = {
    ...clients[index],
    ...updates,
    updatedAt: Date.now()
  }
  
  saveClients(clients)
  return clients[index]
}

// Delete a client
export function deleteClient(id: string): boolean {
  const clients = getClients()
  const filtered = clients.filter(c => c.id !== id)
  
  if (filtered.length === clients.length) return false
  
  saveClients(filtered)
  return true
}

// Get a single client by ID
export function getClient(id: string): SavedClient | null {
  const clients = getClients()
  return clients.find(c => c.id === id) || null
}

// Save clients to localStorage
function saveClients(clients: SavedClient[]): void {
  try {
    localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients))
  } catch (error) {
    console.error('Failed to save clients:', error)
  }
}

// Create client dropdown HTML
export function renderClientSelector(selectedId?: string): string {
  const clients = getClients()
  
  const options = clients.map(client => 
    `<option value="${client.id}" ${client.id === selectedId ? 'selected' : ''}>${client.name}</option>`
  ).join('')
  
  return `
    <option value="">-- Select a saved client --</option>
    ${options}
  `
}

// Get client info as ClientInfo (for use in InvoiceData)
export function getClientForInvoice(id: string): ClientInfo | null {
  const client = getClient(id)
  if (!client) return null
  
  return {
    name: client.name,
    email: client.email,
    address: client.address
  }
}

// Render client list for management UI
export function renderClientList(): string {
  const clients = getClients()
  
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