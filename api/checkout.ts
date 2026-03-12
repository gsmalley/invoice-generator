import Stripe from 'stripe'

// Initialize Stripe with secret key
// Note: In production, use environment variable STRIPE_SECRET_KEY
const stripeSecretKey = process.env.STRIPE_SECRET_KEY

if (!stripeSecretKey && process.env.NODE_ENV !== 'development') {
  console.error('STRIPE_SECRET_KEY is not set')
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16'
}) : null

// Price IDs from Stripe Dashboard (replace with actual IDs after creating products)
const PRICES = {
  free: null, // No payment needed
  unlimited: process.env.STRIPE_PRICE_UNLIMITED || 'price_unlimited_placeholder',
  multiBusiness: process.env.STRIPE_PRICE_MULTI_BUSINESS || 'price_multi_business_placeholder'
}

interface CheckoutRequestBody {
  tier: 'unlimited' | 'multiBusiness'
  successUrl: string
  cancelUrl: string
}

export default async function handler(req: Request): Promise<Response> {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Return mock response in development if Stripe is not configured
  if (!stripe) {
    console.log('Stripe not configured, returning mock checkout session')
    return new Response(JSON.stringify({
      url: 'https://checkout.stripe.com/mock-success',
      sessionId: 'mock_session_' + Date.now()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const body: CheckoutRequestBody = await req.json()
    const { tier, successUrl, cancelUrl } = body

    // Validate tier
    if (!tier || !['unlimited', 'multiBusiness'].includes(tier)) {
      return new Response(JSON.stringify({ error: 'Invalid tier' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get the price ID for the tier
    const priceId = PRICES[tier]
    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Price not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: successUrl || `${req.headers.get('origin')}/success.html`,
      cancel_url: cancelUrl || `${req.headers.get('origin')}/cancel.html`,
      metadata: {
        tier
      }
    })

    return new Response(JSON.stringify({
      url: session.url,
      sessionId: session.id
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Stripe checkout error:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to create checkout session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}