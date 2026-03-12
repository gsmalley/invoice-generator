import Stripe from 'stripe'
import { METADATA_KEYS } from './webhook'

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16'
}) : null

interface StatusQueryParams {
  customerId?: string
}

export default async function handler(req: Request): Promise<Response> {
  // Allow both GET and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    // Get customer ID from query parameter
    const url = new URL(req.url)
    const customerId = url.searchParams.get('customerId')

    // No customer ID means free tier (new user)
    if (!customerId) {
      return new Response(JSON.stringify({
        tier: 'free',
        status: 'active',
        invoiceCount: 0,
        invoiceLimit: 3,
        hasWatermark: true,
        customerId: null
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // If Stripe is not configured, fall back to mock response
    if (!stripe) {
      console.log('Stripe not configured, returning mock status')
      return new Response(JSON.stringify({
        tier: 'free',
        status: 'active',
        invoiceCount: 0,
        invoiceLimit: 3,
        hasWatermark: true,
        customerId,
        mode: 'development'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Fetch customer from Stripe
    let customer: Stripe.Customer
    try {
      customer = await stripe.customers.retrieve(customerId) as Stripe.Customer
    } catch (err) {
      // Customer not found, treat as new user
      return new Response(JSON.stringify({
        tier: 'free',
        status: 'active',
        invoiceCount: 0,
        invoiceLimit: 3,
        hasWatermark: true,
        customerId
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get subscription metadata
    const metadata = customer.metadata || {}
    const tier = metadata[METADATA_KEYS.TIER] || 'free'
    const invoiceCount = parseInt(metadata[METADATA_KEYS.INVOICE_COUNT] || '0', 10)

    // Get tier info
    const tierInfo = getTierInfo(tier)

    return new Response(JSON.stringify({
      tier,
      status: customer.deleted ? 'cancelled' : 'active',
      invoiceCount,
      invoiceLimit: tierInfo.invoiceLimit,
      hasWatermark: !tierInfo.removeWatermark,
      features: tierInfo.features,
      customerId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Status check error:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to check subscription status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

function getTierInfo(tier: string) {
  switch (tier) {
    case 'multiBusiness':
      return {
        invoiceLimit: Infinity,
        removeWatermark: true,
        features: ['Unlimited invoices', 'Multi-business support', 'Export functionality', 'Priority support']
      }
    case 'unlimited':
      return {
        invoiceLimit: Infinity,
        removeWatermark: true,
        features: ['Unlimited invoices', 'No watermark']
      }
    default:
      return {
        invoiceLimit: 3,
        removeWatermark: false,
        features: ['3 free invoices', 'Watermark on PDFs']
      }
  }
}