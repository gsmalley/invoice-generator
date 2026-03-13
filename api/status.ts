// Subscription status API - simplified without Stripe library
// Returns mock/demo response (Stripe integration would require backend changes)

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Allow both GET and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    // Get customer ID from query parameter
    const customerId = req.query.customerId as string | undefined

    // No customer ID means free tier (new user)
    if (!customerId) {
      res.status(200).json({
        tier: 'free',
        status: 'active',
        invoiceCount: 0,
        invoiceLimit: 3,
        hasWatermark: true,
        customerId: null,
        features: ['3 free invoices', 'Watermark on PDFs']
      })
      return
    }

    // Return demo tier (in production, this would query Stripe API via fetch)
    res.status(200).json({
      tier: 'free',
      status: 'active',
      invoiceCount: 0,
      invoiceLimit: 3,
      hasWatermark: true,
      customerId,
      features: ['3 free invoices', 'Watermark on PDFs'],
      mode: 'demo',
      note: 'Stripe integration coming soon'
    })

  } catch (error) {
    console.error('Status check error:', error)
    res.status(500).json({ 
      error: 'Failed to check subscription status',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}