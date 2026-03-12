import Stripe from 'stripe'

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16'
}) : null

// Stripe metadata keys
const METADATA_KEYS = {
  TIER: 'invoice_tier',
  INVOICE_COUNT: 'invoice_count',
  BILLING_CYCLE_START: 'billing_cycle_start',
  SUBSCRIPTION_ID: 'subscription_id'
}

interface WebhookEvent {
  type: string
  data: {
    object: {
      id: string
      customer?: string
      metadata?: Record<string, string>
      status?: string
      current_period_end?: number
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

        // Update customer metadata in Stripe
        await stripe.customers.update(customerId, {
          metadata: {
            [METADATA_KEYS.TIER]: tier,
            [METADATA_KEYS.INVOICE_COUNT]: '0',
            [METADATA_KEYS.BILLING_CYCLE_START]: Date.now().toString(),
            [METADATA_KEYS.SUBSCRIPTION_ID]: session.id
          }
        })

        console.log(`Subscription activated for customer ${customerId}: ${tier}`)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const customerId = subscription.customer as string

        // Update customer metadata with subscription status
        await stripe.customers.update(customerId, {
          metadata: {
            [METADATA_KEYS.SUBSCRIPTION_ID]: subscription.id,
            [METADATA_KEYS.BILLING_CYCLE_START]: ((subscription.current_period_end as number) - 30 * 24 * 60 * 60).toString()
          }
        })

        console.log(`Subscription updated for customer ${customerId}: ${subscription.status}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const customerId = subscription.customer as string

        // Reset to free tier when subscription is cancelled
        await stripe.customers.update(customerId, {
          metadata: {
            [METADATA_KEYS.TIER]: 'free',
            [METADATA_KEYS.SUBSCRIPTION_ID]: ''
          }
        })

        console.log(`Subscription cancelled for customer ${customerId}, reset to free tier`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const customerId = invoice.customer as string

        // Could add past_due status to metadata if needed
        console.log(`Payment failed for customer ${customerId}`)
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

// Export metadata keys for other modules
export { METADATA_KEYS }