import { METADATA_KEYS } from './webhook'
import type Stripe from 'stripe'
import type { Customer } from 'stripe'

// Conditionally import Stripe only if key is available
let stripe: Stripe | null = null
const stripeSecretKey = process.env.STRIPE_SECRET_KEY

if (stripeSecretKey) {
  try {
    const Stripe = require('stripe')
    stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16'
    })
  } catch (err) {
    console.error('Failed to initialize Stripe:', err)
  }
}

export default async function handler(req: Request): Promise<Response> {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const body = await req.json()
    const { customerId } = body

    if (!customerId) {
      return new Response(JSON.stringify({ error: 'Customer ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // If Stripe is not configured, just acknowledge (for development)
    if (!stripe) {
      console.log('Increment invoice count (dev mode) for:', customerId)
      return new Response(JSON.stringify({
        success: true,
        mode: 'development'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get current customer
    const customer = await stripe.customers.retrieve(customerId) as Customer
    const metadata = customer.metadata || {}

    // Get current invoice count
    const currentCount = parseInt(metadata[METADATA_KEYS.INVOICE_COUNT] || '0', 10)
    const newCount = currentCount + 1

    // Update customer metadata
    await stripe.customers.update(customerId, {
      metadata: {
        ...metadata,
        [METADATA_KEYS.INVOICE_COUNT]: newCount.toString()
      }
    })

    return new Response(JSON.stringify({
      success: true,
      invoiceCount: newCount
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Increment invoice error:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to increment invoice count',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}