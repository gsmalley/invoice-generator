import Stripe from 'stripe'

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16'
}) : null

// Simple in-memory store for subscriptions (use database in production)
// Format: { customerId: { tier, status, createdAt, currentPeriodEnd } }
const subscriptions = new Map<string, {
  tier: string
  status: string
  createdAt: number
  currentPeriodEnd: number
  subscriptionId: string
}>()

interface WebhookEvent {
  type: string
  data: {
    object: {
      id: string
      customer?: string
      metadata?: Record<string, string>
      status?: string
      items?: {
        data: Array<{
          price?: {
            id?: string
          }
        }>
      }
    }
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

  const signature = req.headers.get('stripe-signature')

  // In development, just acknowledge the webhook
  if (!stripe || !signature) {
    console.log('Webhook received (dev mode):', req.headers.get('x-stripe-event-type') || 'unknown')
    return new Response(JSON.stringify({ received: true, mode: 'development' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const payload = await req.text()
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured')
      return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify webhook signature
    let event: WebhookEvent
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret) as unknown as WebhookEvent
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const customerId = session.customer as string
        const tier = session.metadata?.tier || 'unlimited'

        subscriptions.set(customerId, {
          tier,
          status: 'active',
          createdAt: Date.now(),
          currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
          subscriptionId: session.id
        })

        console.log(`Subscription activated for customer ${customerId}: ${tier}`)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const customerId = subscription.customer as string

        if (subscriptions.has(customerId)) {
          const existing = subscriptions.get(customerId)!
          subscriptions.set(customerId, {
            ...existing,
            status: subscription.status || existing.status,
            currentPeriodEnd: subscription.current_period_end 
              ? (subscription.current_period_end as number) * 1000 
              : existing.currentPeriodEnd
          })

          console.log(`Subscription updated for customer ${customerId}: ${subscription.status}`)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const customerId = subscription.customer as string

        if (subscriptions.has(customerId)) {
          subscriptions.delete(customerId)
          console.log(`Subscription cancelled for customer ${customerId}`)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const customerId = invoice.customer as string

        if (subscriptions.has(customerId)) {
          const existing = subscriptions.get(customerId)!
          subscriptions.set(customerId, {
            ...existing,
            status: 'past_due'
          })

          console.log(`Payment failed for customer ${customerId}`)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(JSON.stringify({ 
      error: 'Webhook handler failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Export for testing
export { subscriptions }