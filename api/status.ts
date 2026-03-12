// Subscription status endpoint
// In production, this would validate the user's session and check their subscription

import { subscriptions } from './webhook'

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
    // In a real app, we'd get the customer ID from the session
    // For now, accept it as a query parameter for testing
    const url = new URL(req.url)
    const customerId = url.searchParams.get('customerId')

    if (!customerId) {
      // Return default free tier status for unauthenticated users
      return new Response(JSON.stringify({
        tier: 'free',
        status: 'active',
        invoiceCount: 0,
        invoiceLimit: 3,
        hasWatermark: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check subscription store
    const subscription = subscriptions.get(customerId)

    if (!subscription) {
      // No subscription found, user is on free tier
      return new Response(JSON.stringify({
        tier: 'free',
        status: 'active',
        invoiceCount: 0,
        invoiceLimit: 3,
        hasWatermark: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Return subscription status
    const tierInfo = getTierInfo(subscription.tier)

    return new Response(JSON.stringify({
      tier: subscription.tier,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      invoiceCount: 0, // Would come from database
      invoiceLimit: tierInfo.invoiceLimit,
      hasWatermark: !tierInfo.removeWatermark,
      features: tierInfo.features
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