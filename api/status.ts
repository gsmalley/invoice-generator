// Subscription status API - simplified without Stripe library
// Returns mock/demo response (Stripe integration would require backend changes)

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
        customerId: null,
        features: ['3 free invoices', 'Watermark on PDFs']
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Return demo tier (in production, this would query Stripe API via fetch)
    return new Response(JSON.stringify({
      tier: 'free',
      status: 'active',
      invoiceCount: 0,
      invoiceLimit: 3,
      hasWatermark: true,
      customerId,
      features: ['3 free invoices', 'Watermark on PDFs'],
      mode: 'demo',
      note: 'Stripe integration coming soon'
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