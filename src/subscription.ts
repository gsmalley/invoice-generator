// Subscription management module
// Handles tier checks, upgrade flows, and invoice limits

export interface SubscriptionStatus {
  tier: 'free' | 'unlimited' | 'multiBusiness'
  status: 'active' | 'past_due' | 'cancelled'
  invoiceCount: number
  invoiceLimit: number
  hasWatermark: boolean
  currentPeriodEnd?: number
  features: string[]
}

// Pricing tiers configuration
export const PRICING_TIERS = {
  free: {
    name: 'Free',
    price: 0,
    priceDisplay: 'Free',
    invoiceLimit: 3,
    description: 'Perfect for trying things out',
    features: [
      '3 invoices per month',
      'Watermark on PDFs',
      'Basic invoice templates',
      'Local storage'
    ],
    cta: 'Get Started',
    highlighted: false
  },
  unlimited: {
    name: 'Unlimited',
    price: 5,
    priceDisplay: '$5/month',
    invoiceLimit: Infinity,
    description: 'For freelancers who need more',
    features: [
      'Unlimited invoices',
      'No watermark',
      'Priority support',
      'Cloud sync'
    ],
    cta: 'Upgrade Now',
    highlighted: true
  },
  multiBusiness: {
    name: 'Multi-Business',
    price: 10,
    priceDisplay: '$10/month',
    invoiceLimit: Infinity,
    description: 'For agencies and teams',
    features: [
      'Everything in Unlimited',
      'Multiple businesses',
      'Export functionality',
      'Advanced analytics',
      'API access'
    ],
    cta: 'Upgrade Now',
    highlighted: false
  }
}

// Default subscription (free tier)
const defaultSubscription: SubscriptionStatus = {
  tier: 'free',
  status: 'active',
  invoiceCount: 0,
  invoiceLimit: 3,
  hasWatermark: true,
  features: PRICING_TIERS.free.features
}

// Current subscription state
let currentSubscription: SubscriptionStatus = { ...defaultSubscription }

// Load subscription status from API or localStorage
export async function loadSubscriptionStatus(): Promise<SubscriptionStatus> {
  try {
    // Try to get from API first
    const response = await fetch('/api/status')
    if (response.ok) {
      const data = await response.json()
      currentSubscription = { ...defaultSubscription, ...data }
      return currentSubscription
    }
  } catch (error) {
    console.error('Failed to load subscription status:', error)
  }

  // Fallback to localStorage
  const stored = localStorage.getItem('subscription_status')
  if (stored) {
    try {
      currentSubscription = { ...defaultSubscription, ...JSON.parse(stored) }
    } catch {
      currentSubscription = { ...defaultSubscription }
    }
  }

  return currentSubscription
}

// Save subscription to localStorage
function saveSubscription(status: SubscriptionStatus): void {
  localStorage.setItem('subscription_status', JSON.stringify(status))
  currentSubscription = status
}

// Check if user can create more invoices
export function canCreateInvoice(): { allowed: boolean; reason?: string } {
  if (currentSubscription.tier === 'free') {
    if (currentSubscription.invoiceCount >= currentSubscription.invoiceLimit) {
      return {
        allowed: false,
        reason: `You've reached your free limit of ${currentSubscription.invoiceLimit} invoices. Upgrade to Unlimited for more!`
      }
    }
  }
  return { allowed: true }
}

// Increment invoice count
export function incrementInvoiceCount(): void {
  currentSubscription.invoiceCount++
  saveSubscription(currentSubscription)
}

// Get current subscription
export function getSubscription(): SubscriptionStatus {
  return { ...currentSubscription }
}

// Initiate upgrade flow
export async function initiateUpgrade(tier: 'unlimited' | 'multiBusiness'): Promise<{ url?: string; error?: string }> {
  try {
    const origin = window.location.origin
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tier,
        successUrl: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/?cancelled=true`
      })
    })

    if (!response.ok) {
      const error = await response.json()
      return { error: error.error || 'Failed to create checkout session' }
    }

    const data = await response.json()
    
    // If we got a URL, redirect to Stripe
    if (data.url) {
      window.location.href = data.url
      return { url: data.url }
    }

    return { error: 'No checkout URL received' }
  } catch (error) {
    console.error('Upgrade error:', error)
    return { error: 'Failed to initiate upgrade. Please try again.' }
  }
}

// Render pricing cards HTML
export function renderPricingCards(currentTier: string = 'free'): string {
  const tiers = Object.entries(PRICING_TIERS)
  
  return tiers.map(([key, tier]) => {
    const isCurrent = key === currentTier
    const isHighlighted = tier.highlighted
    
    let buttonText = tier.cta
    if (isCurrent) buttonText = 'Current Plan'
    
    return `
      <div class="pricing-card ${isHighlighted ? 'highlighted' : ''} ${isCurrent ? 'current' : ''}">
        ${isHighlighted ? '<div class="popular-badge">Most Popular</div>' : ''}
        <h3 class="pricing-title">${tier.name}</h3>
        <div class="pricing-price">
          <span class="price-amount">$${tier.price}</span>
          <span class="price-period">/month</span>
        </div>
        <p class="pricing-description">${tier.description}</p>
        <ul class="pricing-features">
          ${tier.features.map(f => `<li>✓ ${f}</li>`).join('')}
        </ul>
        <button 
          class="btn ${isHighlighted ? 'btn-primary' : 'btn-outline'} upgrade-btn" 
          data-tier="${key}"
          ${isCurrent ? 'disabled' : ''}
        >
          ${buttonText}
        </button>
      </div>
    `
  }).join('')
}