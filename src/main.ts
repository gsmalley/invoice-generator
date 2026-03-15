import './style.css'
import type { LineItem, InvoiceData } from './types'
import { downloadInvoicePDF } from './pdf-generator'
import { loadSubscriptionStatus, canCreateInvoice, incrementInvoiceCount, initiateUpgrade, renderPricingCards, handleCheckoutSuccess } from './subscription'
import { initAuth, getAuthState, signIn, signUp, signOut } from './supabase'
import * as clients from './clients'

// Global auth state (updated on init and after auth changes)
let authState: { user: any, loading: boolean, error: string | null } = { user: null, loading: true, error: null }

// localStorage key
const STORAGE_KEY = 'invoice_draft'

// LocalStorage Functions
function saveToLocalStorage(data: InvoiceData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    showToast('Draft auto-saved')
  } catch (e) {
    console.error('Failed to save to localStorage:', e)
  }
}

function loadFromLocalStorage(): InvoiceData | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : null
  } catch (e) {
    console.error('Failed to load from localStorage:', e)
    return null
  }
}

function clearLocalStorage(): void {
  localStorage.removeItem(STORAGE_KEY)
}

function clearDraft(): void {
  clearLocalStorage()
  
  // Reset state to default values
  state.business = { name: '', email: '', phone: '', website: '', address: '' }
  state.client = { name: '', email: '', address: '' }
  state.invoice = {
    number: 'INV-001',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  }
  state.settings = { currency: 'USD', taxRate: 0, discount: 0 }
  state.lineItems = [{ description: '', quantity: 1, rate: 0 }]
  state.notes = {
    paymentTerms: 'Payment is due within 30 days of invoice date. Thank you for your business!',
    thankYou: 'Thank you for your business!'
  }
  
  render()
  setupEventListeners()
  showToast('Draft cleared')
}

// Toast notification
function showToast(message: string) {
  const existing = document.querySelector('.toast')
  if (existing) existing.remove()
  
  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.textContent = message
  document.body.appendChild(toast)
  
  setTimeout(() => toast.classList.add('show'), 10)
  setTimeout(() => {
    toast.classList.remove('show')
    setTimeout(() => toast.remove(), 300)
  }, 2000)
}

function showAuthModal(mode: 'login' | 'signup' = 'login') {
  // Remove existing modal if any
  const existing = document.querySelector('.auth-modal-overlay')
  if (existing) existing.remove()
  
  const isLogin = mode === 'login'
  const modal = document.createElement('div')
  modal.className = 'modal-overlay auth-modal-overlay'
  modal.innerHTML = `
    <div class="modal-content auth-modal">
      <button class="modal-close auth-modal-close">×</button>
      <div class="auth-modal-header">
        <div class="logo">
          <div class="logo-icon">IOU</div>
          <span>Maker</span>
        </div>
        <h2>${isLogin ? 'Welcome back' : 'Create an account'}</h2>
        <p class="auth-subtitle">${isLogin ? 'Sign in to manage your invoices' : 'Start creating invoices in seconds'}</p>
      </div>
      
      <form class="auth-form" id="auth-form">
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-input" name="email" placeholder="you@example.com" required>
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input type="password" class="form-input" name="password" placeholder="••••••••" required minlength="6">
        </div>
        ${!isLogin ? `
        <div class="form-group">
          <label class="form-label">Confirm Password</label>
          <input type="password" class="form-input" name="confirmPassword" placeholder="••••••••" required minlength="6">
        </div>
        ` : ''}
        
        <div class="auth-error" id="auth-error" style="display: none;"></div>
        
        <button type="submit" class="btn btn-primary btn-full" id="auth-submit-btn">
          ${isLogin ? 'Sign In' : 'Create Account'}
        </button>
      </form>
      
      <div class="auth-footer">
        <p>${isLogin ? "Don't have an account?" : 'Already have an account?'} 
          <a href="#" id="auth-toggle">${isLogin ? 'Sign up' : 'Sign in'}</a>
        </p>
      </div>
    </div>
  `
  document.body.appendChild(modal)
  
  // Close handlers
  modal.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).classList.contains('modal-overlay') || 
        (e.target as HTMLElement).classList.contains('auth-modal-close')) {
      modal.remove()
    }
  })
  
  // Toggle between login and signup
  modal.querySelector('#auth-toggle')?.addEventListener('click', (e) => {
    e.preventDefault()
    showAuthModal(isLogin ? 'signup' : 'login')
  })
  
  // Form submission
  modal.querySelector('#auth-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const formData = new FormData(form)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string
    const submitBtn = form.querySelector('#auth-submit-btn') as HTMLButtonElement
    
    const errorEl = document.getElementById('auth-error')
    
    // Client-side validation
    if (!isLogin && password !== confirmPassword) {
      if (errorEl) {
        errorEl.textContent = 'Passwords do not match'
        errorEl.style.display = 'block'
      }
      return
    }
    
    // Show loading state
    submitBtn.disabled = true
    submitBtn.textContent = isLogin ? 'Signing in...' : 'Creating account...'
    if (errorEl) errorEl.style.display = 'none'
    
    try {
      if (isLogin) {
        const result = await signIn(email, password)
        if (result.error) {
          if (errorEl) {
            errorEl.textContent = result.error
            errorEl.style.display = 'block'
          }
        } else {
          showToast('Welcome back!')
          modal.remove()
          render()
          setupEventListeners()
          // Load clients if logged in
          if (getAuthState().user) {
            (window as any).loadClientsList?.()
          }
        }
      } else {
        const result = await signUp(email, password)
        if (result.error) {
          if (errorEl) {
            errorEl.textContent = result.error
            errorEl.style.display = 'block'
          }
        } else {
          showToast('Account created! Please check your email to verify.')
          modal.remove()
        }
      }
    } catch (err: any) {
      if (errorEl) {
        errorEl.textContent = 'Something went wrong. Please try again.'
        errorEl.style.display = 'block'
      }
    } finally {
      submitBtn.disabled = false
      submitBtn.textContent = isLogin ? 'Sign In' : 'Create Account'
    }
  })
}

async function handleLogout() {
  await signOut()
  showToast('Logged out successfully')
  render()
  setupEventListeners()
}

// Icons as SVG strings
const icons = {
  document: `<svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>`,
  folder: `<svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>`,
  users: `<svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>`,
  clientIcon: `<svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>`,
  settings: `<svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.165z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>`,
  user: `<svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>`,
  logout: `<svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>`,
  plus: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>`,
  trash: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`,
  download: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>`,
  eye: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>`,
  save: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>`
}

// Application State
type ViewType = 'invoice' | 'invoices' | 'clients' | 'settings' | 'profile'

let currentView: ViewType = 'invoice'

// URL-based routing
function getViewFromUrl(): ViewType {
  const path = window.location.pathname
  if (path === '/') return 'invoice'
  if (path === '/invoices') return 'invoices'
  if (path === '/clients') return 'clients'
  if (path === '/settings') return 'settings'
  if (path === '/profile') return 'profile'
  return 'invoice'
}

function updateUrl(view: ViewType) {
  const pathMap: Record<ViewType, string> = {
    'invoice': '/',
    'invoices': '/invoices',
    'clients': '/clients',
    'settings': '/settings',
    'profile': '/profile'
  }
  const newPath = pathMap[view] || '/'
  if (window.location.pathname !== newPath) {
    history.pushState({}, '', newPath)
  }
}

const state: InvoiceData = {
  business: {
    name: '',
    email: '',
    phone: '',
    website: '',
    address: ''
  },
  client: {
    name: '',
    email: '',
    address: ''
  },
  invoice: {
    number: 'INV-001',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  },
  settings: {
    currency: 'USD',
    taxRate: 0,
    discount: 0
  },
  lineItems: [
    { description: 'Web Development Services', quantity: 10, rate: 150 },
    { description: 'UI/UX Design', quantity: 5, rate: 100 }
  ],
  notes: {
    paymentTerms: 'Payment is due within 30 days of invoice date. Thank you for your business!',
    thankYou: 'Thank you for your business!'
  }
}

// Currency formatter
const currencySymbols: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: '$'
}

function formatCurrency(amount: number): string {
  const symbol = currencySymbols[state.settings.currency] || '$'
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Calculate totals
function calculateTotals() {
  const subtotal = state.lineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0)
  const tax = subtotal * (state.settings.taxRate / 100)
  const discount = subtotal * (state.settings.discount / 100)
  const total = subtotal + tax - discount
  return { subtotal, tax, discount, total }
}

// Render Sidebar
function renderSidebar(): string {
  return `
    <aside class="sidebar">
      <div class="logo">
        <div class="logo-icon">IOU</div>
        <span>Maker</span>
      </div>
      
      <nav class="nav-section">
        <div class="nav-label">Menu</div>
        <button class="nav-item ${currentView === 'invoice' ? 'active' : ''}" data-view="invoice">
          ${icons.document}
          New Invoice
        </button>
        <button class="nav-item ${currentView === 'invoices' ? 'active' : ''}" data-view="invoices">
          ${icons.folder}
          Invoices
        </button>
        <button class="nav-item ${currentView === 'clients' ? 'active' : ''}" data-view="clients">
          ${icons.clientIcon}
          Clients
        </button>
        <button class="nav-item ${currentView === 'settings' ? 'active' : ''}" data-view="settings">
          ${icons.settings}
          Settings
        </button>
      </nav>
      
      <nav class="nav-section" style="margin-top: auto;">
        <div class="nav-label">Account</div>
        ${authState.user ? `
        <button class="nav-item ${currentView === 'profile' ? 'active' : ''}" data-view="profile">
          ${icons.user}
          Profile
        </button>
        <button class="nav-item" id="logout-btn">
          ${icons.logout}
          Logout
        </button>
        ` : `
        <button class="nav-item" id="login-btn">
          ${icons.user}
          Login
        </button>
        `}
      </nav>
    </aside>
  `
}

// Render line item row
function renderLineItemRow(item: LineItem, index: number): string {
  const amount = item.quantity * item.rate
  return `
    <tr data-index="${index}">
      <td data-label="Description">
        <input type="text" class="table-input" 
          value="${item.description}" 
          placeholder="Service or product description"
          data-field="description" data-index="${index}">
      </td>
      <td data-label="Qty">
        <input type="number" class="table-input" 
          value="${item.quantity}" min="1"
          data-field="quantity" data-index="${index}">
      </td>
      <td data-label="Rate">
        <input type="number" class="table-input amount" 
          value="${item.rate.toFixed(2)}" min="0" step="0.01"
          data-field="rate" data-index="${index}">
      </td>
      <td data-label="Amount">
        <input type="text" class="table-input amount" 
          value="${formatCurrency(amount)}" readonly>
      </td>
      <td data-label="">
        <button type="button" class="btn-icon" title="Remove" data-action="remove" data-index="${index}">
          ${icons.trash}
        </button>
      </td>
    </tr>
  `
}

// Render totals section
function renderTotals(): string {
  const { subtotal, tax, discount, total } = calculateTotals()
  return `
    <div class="totals-section">
      <div class="totals-table">
        <div class="totals-row">
          <span>Subtotal</span>
          <span class="value">${formatCurrency(subtotal)}</span>
        </div>
        <div class="totals-row">
          <span>Tax (${state.settings.taxRate}%)</span>
          <span class="value">${formatCurrency(tax)}</span>
        </div>
        <div class="totals-row">
          <span>Discount (${state.settings.discount}%)</span>
          <span class="value">-${formatCurrency(discount)}</span>
        </div>
        <div class="totals-row total">
          <span>Total</span>
          <span class="value">${formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  `
}

// Render main content based on current view
function renderMainContent(): string {
  switch (currentView) {
    case 'clients':
      return renderClientsPage()
    case 'invoices':
      return renderInvoicesListPage()
    case 'settings':
      return renderSettingsPage()
    case 'profile':
      return renderProfilePage()
    default:
      return renderInvoiceForm()
  }
}

// Render Clients management page
function renderClientsPage(): string {
  return `
    <main class="main-content">
      <header class="page-header">
        <h1 class="page-title">Clients</h1>
        <p class="page-subtitle">Manage your saved clients</p>
      </header>
      
      <div class="clients-section">
        <div class="clients-header">
          <button class="btn btn-primary" id="add-client-btn">
            ${icons.plus}
            Add Client
          </button>
        </div>
        
        <div class="clients-list" id="clients-list">
          <p class="loading">Loading clients...</p>
        </div>
        
        <div class="client-form-container" id="client-form-container" style="display: none;">
          ${clients.renderClientForm()}
        </div>
      </div>
    </main>
  `
}

// Load clients list dynamically
async function loadClientsList() {
  const container = document.getElementById('clients-list')
  if (!container) return
  
  try {
    const html = await clients.renderClientList()
    container.innerHTML = html
  } catch (error) {
    container.innerHTML = '<p class="empty-state">Failed to load clients. Please log in.</p>'
  }
}

// Render Invoices list page
function renderInvoicesListPage(): string {
  return `
    <main class="main-content">
      <header class="page-header">
        <h1 class="page-title">Invoices</h1>
        <button class="btn btn-primary" data-view="invoice">
          ${icons.plus} New Invoice
        </button>
      </header>
      <div class="invoices-list">
        <p class="empty-state">No invoices yet. Create your first invoice!</p>
      </div>
    </main>
  `
}

// Render Settings page
function renderSettingsPage(): string {
  return `
    <main class="main-content">
      <header class="page-header">
        <h1 class="page-title">Settings</h1>
      </header>
      <div class="settings-section">
        <h3>Invoice Defaults</h3>
        <div class="form-group">
          <label>Default Currency</label>
          <select class="form-control" data-field="currency">
            <option value="USD" ${state.settings.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
            <option value="EUR" ${state.settings.currency === 'EUR' ? 'selected' : ''}>EUR (€)</option>
            <option value="GBP" ${state.settings.currency === 'GBP' ? 'selected' : ''}>GBP (£)</option>
            <option value="CAD" ${state.settings.currency === 'CAD' ? 'selected' : ''}>CAD ($)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Default Tax Rate (%)</label>
          <input type="number" class="form-control" data-field="taxRate" value="${state.settings.taxRate}" min="0" max="100">
        </div>
      </div>
    </main>
  `
}

// Render Profile page
function renderProfilePage(): string {
  return `
    <main class="main-content">
      <header class="page-header">
        <h1 class="page-title">Profile</h1>
      </header>
      <div class="profile-section">
        <h3>Account Settings</h3>
        <div class="form-group">
          <label>Email</label>
          <input type="email" class="form-control" value="${state.business.email}" placeholder="your@email.com">
        </div>
      </div>
    </main>
  `
}

// Render Invoice Form
function renderInvoiceForm(): string {
  const lineItemsHtml = state.lineItems.map(renderLineItemRow).join('')
  const totalsHtml = renderTotals()
  
  return `
    <main class="main-content">
      <header class="page-header">
        <h1 class="page-title">Create New Invoice</h1>
        <p class="page-subtitle">Fill in the details below to generate a professional invoice</p>
      </header>
      
      <form class="invoice-form" id="invoice-form">
        <!-- Your Business Info -->
        <div class="form-section">
          <h3 class="section-title">Your Business</h3>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label required">Business Name</label>
              <input type="text" class="form-input" 
                placeholder="Your Business Name"
                name="businessName" value="${state.business.name}">
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" class="form-input" 
                placeholder="you@example.com"
                name="businessEmail" value="${state.business.email}">
            </div>
            <div class="form-group">
              <label class="form-label">Phone</label>
              <input type="tel" class="form-input" 
                placeholder="(555) 123-4567"
                name="businessPhone" value="${state.business.phone}">
            </div>
            <div class="form-group">
              <label class="form-label">Website</label>
              <input type="url" class="form-input" 
                placeholder="https://yourwebsite.com"
                name="businessWebsite" value="${state.business.website}">
            </div>
            <div class="form-group full-width">
              <label class="form-label">Address</label>
              <textarea class="form-input" 
                placeholder="123 Main St, City, State ZIP"
                name="businessAddress">${state.business.address}</textarea>
            </div>
          </div>
        </div>
        
        <!-- Client Info -->
        <div class="form-section">
          <h3 class="section-title">Bill To</h3>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label required">Client Name</label>
              <input type="text" class="form-input" 
                placeholder="Client or Company Name"
                name="clientName" value="${state.client.name}">
            </div>
            <div class="form-group">
              <label class="form-label">Client Email</label>
              <input type="email" class="form-input" 
                placeholder="client@example.com"
                name="clientEmail" value="${state.client.email}">
            </div>
            <div class="form-group full-width">
              <label class="form-label">Client Address</label>
              <textarea class="form-input" 
                placeholder="456 Client Ave, City, State ZIP"
                name="clientAddress">${state.client.address}</textarea>
            </div>
          </div>
        </div>
        
        <!-- Invoice Details -->
        <div class="form-section">
          <h3 class="section-title">Invoice Details</h3>
          <div class="form-grid three-col">
            <div class="form-group">
              <label class="form-label required">Invoice #</label>
              <input type="text" class="form-input" 
                value="${state.invoice.number}"
                name="invoiceNumber">
            </div>
            <div class="form-group">
              <label class="form-label required">Issue Date</label>
              <input type="date" class="form-input" 
                value="${state.invoice.issueDate}"
                name="issueDate">
            </div>
            <div class="form-group">
              <label class="form-label required">Due Date</label>
              <input type="date" class="form-input" 
                value="${state.invoice.dueDate}"
                name="dueDate">
            </div>
          </div>
        </div>
        
        <!-- Currency & Tax -->
        <div class="form-section">
          <h3 class="section-title">Settings</h3>
          <div class="form-grid three-col">
            <div class="form-group">
              <label class="form-label">Currency</label>
              <select class="form-select" name="currency">
                <option value="USD" ${state.settings.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
                <option value="EUR" ${state.settings.currency === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                <option value="GBP" ${state.settings.currency === 'GBP' ? 'selected' : ''}>GBP (£)</option>
                <option value="CAD" ${state.settings.currency === 'CAD' ? 'selected' : ''}>CAD ($)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Tax Rate (%)</label>
              <input type="number" class="form-input" 
                value="${state.settings.taxRate}" min="0" max="100" step="0.1"
                name="taxRate">
            </div>
            <div class="form-group">
              <label class="form-label">Discount (%)</label>
              <input type="number" class="form-input" 
                value="${state.settings.discount}" min="0" max="100" step="0.1"
                name="discount">
            </div>
          </div>
        </div>
        
        <!-- Line Items -->
        <div class="form-section full-width">
          <h3 class="section-title">Line Items</h3>
          <table class="line-items-table">
            <thead>
              <tr>
                <th class="col-description">Description</th>
                <th class="col-qty">Qty</th>
                <th class="col-rate">Rate</th>
                <th class="col-amount">Amount</th>
                <th class="col-actions"></th>
              </tr>
            </thead>
            <tbody id="line-items-body">
              ${lineItemsHtml}
            </tbody>
          </table>
          <button type="button" class="add-item-btn" id="add-item-btn">
            ${icons.plus}
            Add Line Item
          </button>
          
          <div id="totals-section">
            ${totalsHtml}
          </div>
        </div>
        
        <!-- Notes -->
        <div class="form-section">
          <h3 class="section-title">Notes</h3>
          <div class="form-group">
            <label class="form-label">Payment Terms</label>
            <textarea class="form-input" 
              placeholder="Payment is due within 30 days..."
              name="paymentTerms">${state.notes.paymentTerms}</textarea>
          </div>
        </div>
        
        <!-- Footer Message -->
        <div class="form-section">
          <h3 class="section-title">Footer</h3>
          <div class="form-group">
            <label class="form-label">Thank You Message</label>
            <textarea class="form-input" 
              placeholder="Thank you for your business!"
              name="thankYou">${state.notes.thankYou}</textarea>
          </div>
        </div>
        
        <!-- Action Bar -->
        <div class="form-section full-width">
          <div class="action-bar">
            <div class="left">
              <button type="button" class="btn btn-ghost" id="save-draft-btn">
                ${icons.save}
                Save Draft
              </button>
              <button type="button" class="btn btn-ghost" id="clear-draft-btn">
                ${icons.trash}
                Clear Draft
              </button>
            </div>
            <div class="right">
              <button type="button" class="btn btn-outline" id="preview-btn">
                ${icons.eye}
                Preview
              </button>
              <button type="button" class="btn btn-primary" id="download-btn">
                ${icons.download}
                Download PDF
              </button>
            </div>
          </div>
        </div>
      </form>
    </main>
  `
}

// Render entire app
function renderApp(): string {
  return `
    <div class="app-layout">
      ${renderSidebar()}
      ${renderMainContent()}
    </div>
  `
}

// Update line items in state and re-render
function updateLineItem(index: number, field: keyof LineItem, value: string | number) {
  if (field === 'description') {
    state.lineItems[index].description = String(value)
  } else {
    const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value
    if (field === 'quantity') {
      state.lineItems[index].quantity = numValue
    } else if (field === 'rate') {
      state.lineItems[index].rate = numValue
    }
  }
  
  // Auto-save to localStorage on line item change
  saveToLocalStorage(state)
  
  render()
}

// Add new line item
function addLineItem() {
  state.lineItems.push({ description: '', quantity: 1, rate: 0 })
  saveToLocalStorage(state)
  render()
}

// Remove line item
function removeLineItem(index: number) {
  if (state.lineItems.length > 1) {
    state.lineItems.splice(index, 1)
    saveToLocalStorage(state)
    render()
  }
}

// Update form fields in state
function updateFormField(e: Event) {
  const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  const name = target.name
  const value = target.value
  
  switch (name) {
    case 'businessName': state.business.name = value; break
    case 'businessEmail': state.business.email = value; break
    case 'businessPhone': state.business.phone = value; break
    case 'businessWebsite': state.business.website = value; break
    case 'businessAddress': state.business.address = value; break
    case 'clientName': state.client.name = value; break
    case 'clientEmail': state.client.email = value; break
    case 'clientAddress': state.client.address = value; break
    case 'invoiceNumber': state.invoice.number = value; break
    case 'issueDate': state.invoice.issueDate = value; break
    case 'dueDate': state.invoice.dueDate = value; break
    case 'currency': state.settings.currency = value; break
    case 'taxRate': state.settings.taxRate = parseFloat(value) || 0; break
    case 'discount': state.settings.discount = parseFloat(value) || 0; break
    case 'paymentTerms': state.notes.paymentTerms = value; break
    case 'thankYou': state.notes.thankYou = value; break
  }
  
  // Auto-save to localStorage on any field change
  saveToLocalStorage(state)
  
  // Re-render totals when tax or discount changes
  if (name === 'taxRate' || name === 'discount' || name === 'currency') {
    document.getElementById('totals-section')!.innerHTML = renderTotals()
  }
}

// Event delegation for dynamic elements
function setupEventListeners() {
  const app = document.getElementById('app')!
  
  // View switching - handles navigation between Invoice/Clients/Settings views
  app.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const viewButton = target.closest('[data-view]') as HTMLElement
    
    if (viewButton) {
      const view = viewButton.dataset.view as ViewType
      if (view) {
        currentView = view
        updateUrl(view)
        render()
        
        // Load clients list when switching to clients view
        if (view === 'clients') {
          loadClientsList()
        }
      }
    }
  })
  
  // Line items - input changes (but skip re-render on description to prevent focus loss)
  app.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement
    const field = target.dataset.field
    const index = parseInt(target.dataset.index || '0')
    
    if (field) {
      // Update state without re-rendering to prevent focus loss on description input
      if (field === 'description') {
        state.lineItems[index].description = target.value
        saveToLocalStorage(state)
      } else {
        updateLineItem(index, field as keyof LineItem, target.value)
      }
    }
  })
  
  // Prevent keydown from causing input to jump/lose focus
  app.addEventListener('keydown', (e) => {
    const target = e.target as HTMLInputElement
    if (target.dataset.field) {
      // Stop propagation to prevent any default behaviors that might cause focus issues
      e.stopPropagation()
    }
  })
  
  // Line items - remove button
  app.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const action = target.closest('button')?.dataset.action
    const index = target.closest('button')?.dataset.index
    
    if (action === 'remove' && index) {
      removeLineItem(parseInt(index))
    }
  })
  
  // Add item button
  app.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (target.closest('#add-item-btn')) {
      addLineItem()
    }
  })
  
  // Form field changes
  app.addEventListener('change', (e) => {
    updateFormField(e)
  })
  
  // Save draft button
  app.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (target.closest('#save-draft-btn')) {
      saveToLocalStorage(state)
    }
  })
  
  // Clear draft button
  app.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (target.closest('#clear-draft-btn')) {
      clearDraft()
    }
  })
  
  // Preview
  app.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (target.closest('#preview-btn')) {
      showPreviewModal()
    }
  })
  
  // Download PDF
  app.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (target.closest('#download-btn')) {
      // Check subscription before downloading
      checkAndProcessDownload()
    }
  })
  
  // Login button
  app.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (target.closest('#login-btn')) {
      showAuthModal('login')
    }
  })
  
  // Logout button
  app.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (target.closest('#logout-btn')) {
      handleLogout()
    }
  })
  
  // Profile page login button
  app.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (target.closest('#profile-login-btn')) {
      showAuthModal('login')
    }
  })
  
  // Profile page logout button
  app.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (target.closest('#profile-logout-btn')) {
      handleLogout()
    }
  })
}

// Render and initialize
function render() {
  const app = document.getElementById('app')!
  app.innerHTML = renderApp()
}

// Check subscription and process download
async function checkAndProcessDownload() {
  const check = canCreateInvoice()
  
  if (!check.allowed) {
    // Show upgrade prompt
    const upgrade = confirm(`${check.reason}\n\nWould you like to upgrade now?`)
    if (upgrade) {
      showUpgradeModal()
    }
    return
  }
  
  // Process the download
  downloadInvoicePDF(state)
  
  // Increment invoice count for free tier
  incrementInvoiceCount()
  
  // Check if they've reached limit after this download
  loadSubscriptionStatus().then(status => {
    if (status.tier === 'free' && status.invoiceCount >= status.invoiceLimit) {
      showUpgradeModal(true)
    }
  })
}

// Preview modal
function showPreviewModal() {
  const { subtotal, tax, discount, total } = calculateTotals()
  const lineItemsHtml = state.lineItems.map(item => `
    <tr>
      <td>${item.description || '-'}</td>
      <td>${item.quantity}</td>
      <td>${formatCurrency(item.rate)}</td>
      <td>${formatCurrency(item.quantity * item.rate)}</td>
    </tr>
  `).join('')

  const modal = document.createElement('div')
  modal.className = 'modal-overlay'
  modal.innerHTML = `
    <div class="modal-content preview-modal">
      <button class="modal-close" id="preview-close">×</button>
      <div class="preview-header">
        <div class="preview-logo">IOU</div>
        <div class="preview-business">
          <h2>${state.business.name || 'Your Business Name'}</h2>
          <p>${state.business.email}${state.business.phone ? ' • ' + state.business.phone : ''}</p>
          <p>${state.business.address}</p>
        </div>
        <div class="preview-invoice-meta">
          <h1>INVOICE</h1>
          <p><strong>#${state.invoice.number}</strong></p>
          <p>Issued: ${state.invoice.issueDate}</p>
          <p>Due: ${state.invoice.dueDate}</p>
        </div>
      </div>
      <div class="preview-client">
        <h3>Bill To:</h3>
        <p><strong>${state.client.name || 'Client Name'}</strong></p>
        <p>${state.client.email}</p>
        <p>${state.client.address}</p>
      </div>
      <table class="preview-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineItemsHtml}
        </tbody>
      </table>
      <div class="preview-totals">
        <div class="totals-row">
          <span>Subtotal</span>
          <span>${formatCurrency(subtotal)}</span>
        </div>
        <div class="totals-row">
          <span>Tax (${state.settings.taxRate}%)</span>
          <span>${formatCurrency(tax)}</span>
        </div>
        <div class="totals-row">
          <span>Discount (${state.settings.discount}%)</span>
          <span>-${formatCurrency(discount)}</span>
        </div>
        <div class="totals-row total">
          <span>Total</span>
          <span>${formatCurrency(total)}</span>
        </div>
      </div>
      ${state.notes.paymentTerms ? `<div class="preview-notes"><h4>Payment Terms</h4><p>${state.notes.paymentTerms}</p></div>` : ''}
      ${state.notes.thankYou ? `<div class="preview-thanks"><p>${state.notes.thankYou}</p></div>` : ''}
    </div>
  `
  document.body.appendChild(modal)

  // Close handlers
  modal.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).classList.contains('modal-overlay') || 
        (e.target as HTMLElement).id === 'preview-close') {
      modal.remove()
    }
  })
}

// Show upgrade modal
function showUpgradeModal(isLimitReached: boolean = false) {
  const modal = document.createElement('div')
  modal.className = 'modal-overlay'
  modal.innerHTML = `
    <div class="modal-content">
      <button class="modal-close" id="modal-close">×</button>
      <h2>${isLimitReached ? 'Free Limit Reached! 🚀' : 'Upgrade Your Plan'}</h2>
      <p>${isLimitReached 
        ? 'You\'ve used all your free invoices. Upgrade to remove limits!' 
        : 'Unlock unlimited invoices and premium features.'}</p>
      <div class="pricing-grid">
        ${renderPricingCards('free')}
      </div>
    </div>
  `
  document.body.appendChild(modal)
  
  // Close modal handlers
  modal.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).classList.contains('modal-overlay') || 
        (e.target as HTMLElement).id === 'modal-close') {
      modal.remove()
    }
  })
  
  // Upgrade button handlers
  modal.querySelectorAll('.upgrade-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const tier = (e.target as HTMLElement).dataset.tier
      if (tier === 'unlimited' || tier === 'multiBusiness') {
        await initiateUpgrade(tier)
      }
    })
  })
  
  // Client management
  {
    const appEl = document.getElementById('app')!
    appEl.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement
      const action = target.closest('button')?.dataset.action
      const id = target.closest('button')?.dataset.id
      
      // Add client button
      if (target.id === 'add-client-btn') {
        const formContainer = document.getElementById('client-form-container')
        const clientsList = document.getElementById('clients-list')
        if (formContainer) {
          formContainer.style.display = 'block'
          formContainer.innerHTML = clients.renderClientForm()
        }
        if (clientsList) clientsList.style.display = 'none'
        return
      }
      
      // Edit client
      if (action === 'edit' && id) {
        const client = await clients.getClient(id)
        if (client) {
          const formContainer = document.getElementById('client-form-container')
          const clientsList = document.getElementById('clients-list')
          if (formContainer) {
            formContainer.style.display = 'block'
            formContainer.innerHTML = clients.renderClientForm(client)
          }
          if (clientsList) clientsList.style.display = 'none'
        }
        return
      }
      
      // Delete client
      if (action === 'delete' && id) {
        if (confirm('Are you sure you want to delete this client?')) {
          const success = await clients.deleteClient(id)
          if (success) {
            showToast('Client deleted')
            await loadClientsList()
          }
        }
        return
      }
      
      // Cancel client form
      if (target.id === 'cancel-client-btn') {
        const formContainer = document.getElementById('client-form-container')
        const clientsList = document.getElementById('clients-list')
        if (formContainer) formContainer.style.display = 'none'
        if (clientsList) clientsList.style.display = 'block'
        return
      }
    })
  }
  
  // Client form submission
  {
    const appEl = document.getElementById('app')!
    appEl.addEventListener('submit', async (e) => {
      const target = e.target as HTMLFormElement
    
    if (target.id === 'client-form') {
      e.preventDefault()
      const formData = new FormData(target)
      const id = formData.get('id') as string
      
      const clientData = {
        name: formData.get('name') as string,
        email: formData.get('email') as string,
        address: formData.get('address') as string
      }
      
      if (id) {
        // Update existing client
        const result = await clients.updateClient(id, clientData)
        if (result) {
          showToast('Client updated')
        }
      } else {
        // Add new client
        const result = await clients.addClient(clientData)
        if (result) {
          showToast('Client added')
        }
      }
      
      // Show list, hide form, reload clients
      const formContainer = document.getElementById('client-form-container')
      const clientsList = document.getElementById('clients-list')
      if (formContainer) formContainer.style.display = 'none'
      if (clientsList) clientsList.style.display = 'block'
      await loadClientsList()
    }
  })
}
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  // Set initial view from URL
  currentView = getViewFromUrl()
  
  // Check if returning from checkout success
  if (window.location.search.includes('session_id')) {
    handleCheckoutSuccess()
    showToast('Upgrade successful! 🎉')
  }
  
  // Try to load saved draft from localStorage
  const savedData = loadFromLocalStorage()
  if (savedData) {
    Object.assign(state, savedData)
    showToast('Draft loaded')
  }
  
  // Initialize Supabase auth
  await initAuth()
  authState = getAuthState()
  
  if (authState.user) {
    console.log('User logged in:', authState.user.email)
  } else {
    console.log('No user logged in - data will be stored locally')
  }
  
  // Load subscription status
  const subscriptionStatus = await loadSubscriptionStatus()
  
  // Check if watermark should be shown (free tier)
  if (subscriptionStatus.hasWatermark && subscriptionStatus.tier === 'free') {
    console.log('Watermark will be applied to PDFs (free tier)')
  }
  
  render()
  setupEventListeners()
  
  // Load clients if user is logged in
  if (authState.user) {
    loadClientsList()
  }
})