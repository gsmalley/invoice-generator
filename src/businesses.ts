// Business management module
// Handles CRUD operations for saved businesses (multi-business support)

import type { BusinessInfo } from './types'

// Storage key
const BUSINESSES_STORAGE_KEY = 'saved_businesses'

// Business with ID
export interface SavedBusiness extends BusinessInfo {
  id: string
  createdAt: number
  updatedAt: number
}

// Currently selected business ID
const SELECTED_BUSINESS_KEY = 'selected_business_id'

// Get all saved businesses
export function getBusinesses(): SavedBusiness[] {
  try {
    const stored = localStorage.getItem(BUSINESSES_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Failed to load businesses:', error)
    return []
  }
}

// Generate unique ID
function generateId(): string {
  return 'biz_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

// Save a new business
export function addBusiness(business: Omit<SavedBusiness, 'id' | 'createdAt' | 'updatedAt'>): SavedBusiness {
  const businesses = getBusinesses()
  
  const newBusiness: SavedBusiness = {
    ...business,
    id: generateId(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  
  businesses.push(newBusiness)
  saveBusinesses(businesses)
  
  // Auto-select the new business if it's the first one
  if (businesses.length === 1) {
    setSelectedBusinessId(newBusiness.id)
  }
  
  return newBusiness
}

// Update an existing business
export function updateBusiness(id: string, updates: Partial<Omit<SavedBusiness, 'id' | 'createdAt'>>): SavedBusiness | null {
  const businesses = getBusinesses()
  const index = businesses.findIndex(b => b.id === id)
  
  if (index === -1) return null
  
  businesses[index] = {
    ...businesses[index],
    ...updates,
    updatedAt: Date.now()
  }
  
  saveBusinesses(businesses)
  return businesses[index]
}

// Delete a business
export function deleteBusiness(id: string): boolean {
  const businesses = getBusinesses()
  const filtered = businesses.filter(b => b.id !== id)
  
  if (filtered.length === businesses.length) return false
  
  saveBusinesses(filtered)
  
  // If we deleted the selected business, select the first one
  if (getSelectedBusinessId() === id && filtered.length > 0) {
    setSelectedBusinessId(filtered[0].id)
  } else if (filtered.length === 0) {
    clearSelectedBusinessId()
  }
  
  return true
}

// Get a single business by ID
export function getBusiness(id: string): SavedBusiness | null {
  const businesses = getBusinesses()
  return businesses.find(b => b.id === id) || null
}

// Get currently selected business ID
export function getSelectedBusinessId(): string | null {
  return localStorage.getItem(SELECTED_BUSINESS_KEY)
}

// Set selected business ID
export function setSelectedBusinessId(id: string): void {
  localStorage.setItem(SELECTED_BUSINESS_KEY, id)
}

// Clear selected business
export function clearSelectedBusinessId(): void {
  localStorage.removeItem(SELECTED_BUSINESS_KEY)
}

// Get currently selected business (full object)
export function getSelectedBusiness(): SavedBusiness | null {
  const id = getSelectedBusinessId()
  if (!id) return null
  return getBusiness(id)
}

// Save businesses to localStorage
function saveBusinesses(businesses: SavedBusiness[]): void {
  try {
    localStorage.setItem(BUSINESSES_STORAGE_KEY, JSON.stringify(businesses))
  } catch (error) {
    console.error('Failed to save businesses:', error)
  }
}

// Create business dropdown HTML
export function renderBusinessSelector(selectedId?: string): string {
  const businesses = getBusinesses()
  
  if (businesses.length === 0) {
    return ''
  }
  
  const options = businesses.map(business => 
    `<option value="${business.id}" ${business.id === selectedId ? 'selected' : ''}>${business.name}</option>`
  ).join('')
  
  return `
    <select class="form-input" id="business-selector" name="business">
      <option value="">-- Select Business --</option>
      ${options}
    </select>
  `
}

// Get business info as BusinessInfo (for use in InvoiceData)
export function getBusinessForInvoice(id: string): BusinessInfo | null {
  const business = getBusiness(id)
  if (!business) return null
  
  return {
    name: business.name,
    email: business.email,
    phone: business.phone,
    website: business.website,
    address: business.address
  }
}

// Render business list for management UI
export function renderBusinessList(): string {
  const businesses = getBusinesses()
  const selectedId = getSelectedBusinessId()
  
  if (businesses.length === 0) {
    return '<p class="empty-state">No saved businesses yet. Add your first business!</p>'
  }
  
  return businesses.map(business => `
    <div class="business-card ${business.id === selectedId ? 'selected' : ''}" data-id="${business.id}">
      <div class="business-info">
        <h4>${business.name}</h4>
        <p>${business.email || 'No email'}</p>
        <p class="business-address">${business.address || 'No address'}</p>
        ${business.id === selectedId ? '<span class="badge">Active</span>' : ''}
      </div>
      <div class="business-actions">
        <button class="btn btn-sm btn-outline" data-action="edit" data-id="${business.id}">Edit</button>
        <button class="btn btn-sm btn-ghost" data-action="delete" data-id="${business.id}">Delete</button>
      </div>
    </div>
  `).join('')
}

// Render add/edit business form
export function renderBusinessForm(business?: SavedBusiness): string {
  return `
    <form class="business-form" id="business-form">
      <div class="form-group">
        <label class="form-label required">Business Name</label>
        <input type="text" class="form-input" name="name" value="${business?.name || ''}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" class="form-input" name="email" value="${business?.email || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Phone</label>
        <input type="tel" class="form-input" name="phone" value="${business?.phone || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Website</label>
        <input type="url" class="form-input" name="website" value="${business?.website || ''}" placeholder="https://">
      </div>
      <div class="form-group">
        <label class="form-label">Address</label>
        <textarea class="form-input" name="address">${business?.address || ''}</textarea>
      </div>
      <input type="hidden" name="id" value="${business?.id || ''}">
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" id="cancel-business-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">${business ? 'Update Business' : 'Add Business'}</button>
      </div>
    </form>
  `
}

// Check if multi-business feature is available (tier check would happen here)
// For now, allow it always - Stripe tier check happens at checkout time
export function canUseMultiBusiness(): boolean {
  // TODO: Check subscription tier from Stripe/localStorage
  // For now, return true to enable feature
  return true
}

// Get businesses count
export function getBusinessesCount(): number {
  return getBusinesses().length
}