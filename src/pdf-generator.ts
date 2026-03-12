import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { InvoiceData } from './types'

// Currency symbols mapping
const currencySymbols: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: '$',
  AUD: 'A$',
  JPY: '¥'
}

// Format currency amount
function formatCurrency(amount: number, currency: string = 'USD'): string {
  const symbol = currencySymbols[currency] || '$'
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Format date for display
function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Primary color (#0F766E)
const PRIMARY_COLOR: [number, number, number] = [15, 118, 110]

export function generateInvoicePDF(data: InvoiceData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter'
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 48
  let yPos = margin

  // ========== HEADER ==========
  // Logo placeholder (IOU box)
  doc.setFillColor(...PRIMARY_COLOR)
  doc.roundedRect(margin, yPos, 48, 32, 3, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('IOU', margin + 24, yPos + 20, { align: 'center' })

  // Business info
  doc.setTextColor(15, 23, 42) // #0F172A
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(data.business.name || 'Your Business Name', margin, yPos + 10)

  doc.setTextColor(100, 116, 139) // #64748B
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  const businessDetails: string[] = []
  if (data.business.email) businessDetails.push(data.business.email)
  if (data.business.phone) businessDetails.push(data.business.phone)
  if (data.business.website) businessDetails.push(data.business.website)
  if (data.business.address) businessDetails.push(data.business.address)

  doc.text(businessDetails.join('\n'), margin, yPos + 26)

  // Invoice title (right side)
  doc.setTextColor(...PRIMARY_COLOR)
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.text('INVOICE', pageWidth - margin, yPos, { align: 'right' })

  // Invoice meta (right side)
  yPos = margin + 10
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  const metaLines = [
    `Invoice #: ${data.invoice.number || 'INV-001'}`,
    `Issue Date: ${formatDate(data.invoice.issueDate)}`,
    `Due Date: ${formatDate(data.invoice.dueDate)}`
  ]

  let metaY = yPos + 20
  metaLines.forEach(line => {
    const [label, value] = line.split(': ')
    doc.setFont('helvetica', 'bold')
    doc.text(`${label}:`, pageWidth - margin - 100, metaY)
    doc.setFont('helvetica', 'normal')
    doc.text(value, pageWidth - margin, metaY, { align: 'right' })
    metaY += 16
  })

  // Header underline
  yPos = margin + 90
  doc.setDrawColor(...PRIMARY_COLOR)
  doc.setLineWidth(2)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 30

  // ========== ADDRESSES ==========
  const colWidth = (pageWidth - 2 * margin) / 2 - 20

  // From (left column)
  doc.setTextColor(...PRIMARY_COLOR)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('FROM', margin, yPos)

  yPos += 14
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(data.business.name || 'Your Business Name', margin, yPos)

  yPos += 14
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  const fromLines: string[] = []
  if (data.business.address) fromLines.push(data.business.address)
  if (data.business.email) fromLines.push(data.business.email)
  fromLines.forEach(line => {
    doc.text(line, margin, yPos)
    yPos += 12
  })

  // Bill To (right column)
  const rightColX = pageWidth / 2 + 10
  doc.setTextColor(...PRIMARY_COLOR)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('BILL TO', rightColX, margin + 90)

  let rightYPos = margin + 90 + 14
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(data.client.name || 'Client Name', rightColX, rightYPos)

  rightYPos += 14
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  const toLines: string[] = []
  if (data.client.address) toLines.push(data.client.address)
  if (data.client.email) toLines.push(data.client.email)
  toLines.forEach(line => {
    doc.text(line, rightColX, rightYPos)
    rightYPos += 12
  })

  // Reset yPos for line items
  yPos = Math.max(yPos, rightYPos) + 30

  // ========== LINE ITEMS TABLE ==========
  const tableData = data.lineItems.map(item => [
    item.description,
    item.quantity.toString(),
    formatCurrency(item.rate, data.settings.currency),
    formatCurrency(item.quantity * item.rate, data.settings.currency)
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['Description', 'Qty', 'Rate', 'Amount']],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: PRIMARY_COLOR,
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 10,
      textColor: [15, 23, 42]
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 40 },
      2: { halign: 'center', cellWidth: 60 },
      3: { halign: 'right', cellWidth: 70 }
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251]
    },
    margin: { left: margin, right: margin }
  })

  // Get the final Y position after the table
  // @ts-ignore - jsPDF autoTable adds lastAutoTable
  yPos = (doc as any).lastAutoTable.finalY + 20

  // ========== TOTALS ==========
  const subtotal = data.lineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0)
  const tax = subtotal * (data.settings.taxRate / 100)
  const discount = subtotal * (data.settings.discount / 100)
  const total = subtotal + tax - discount

  const totalsX = pageWidth - margin - 180

  // Subtotal
  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  doc.setFont('helvetica', 'normal')
  doc.text('Subtotal', totalsX, yPos)
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.text(formatCurrency(subtotal, data.settings.currency), pageWidth - margin, yPos, { align: 'right' })

  yPos += 16

  // Tax
  if (data.settings.taxRate > 0) {
    doc.setTextColor(100, 116, 139)
    doc.setFont('helvetica', 'normal')
    doc.text(`Tax (${data.settings.taxRate}%)`, totalsX, yPos)
    doc.text(formatCurrency(tax, data.settings.currency), pageWidth - margin, yPos, { align: 'right' })
    yPos += 16
  }

  // Discount
  if (data.settings.discount > 0) {
    doc.setTextColor(100, 116, 139)
    doc.setFont('helvetica', 'normal')
    doc.text(`Discount (${data.settings.discount}%)`, totalsX, yPos)
    doc.text(`-${formatCurrency(discount, data.settings.currency)}`, pageWidth - margin, yPos, { align: 'right' })
    yPos += 16
  }

  // Total line
  yPos += 8
  doc.setDrawColor(...PRIMARY_COLOR)
  doc.setLineWidth(2)
  doc.line(totalsX - 10, yPos, pageWidth - margin, yPos)
  yPos += 16

  // Total
  doc.setFontSize(14)
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.text('Total Due', totalsX, yPos)
  doc.setTextColor(...PRIMARY_COLOR)
  doc.text(formatCurrency(total, data.settings.currency), pageWidth - margin, yPos, { align: 'right' })

  // ========== FOOTER ==========
  yPos += 40
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(1)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 20

  // Payment Terms (left)
  doc.setTextColor(148, 163, 184)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('PAYMENT TERMS', margin, yPos)

  yPos += 12
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  const paymentTerms = data.notes.paymentTerms || 'Payment is due within 30 days of invoice date.'
  doc.text(paymentTerms, margin, yPos, { maxWidth: colWidth })

  // Thank You (right)
  doc.setTextColor(148, 163, 184)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('THANK YOU!', rightColX, margin + 90)

  yPos = margin + 90 + 12
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  const thankYou = data.notes.thankYou || 'Thank you for your business!'
  doc.text(thankYou, rightColX, yPos, { maxWidth: colWidth })

  // Watermark (for visual effect)
  doc.setTextColor(15, 118, 110)
  doc.setGState(new (doc as any).GState({ opacity: 0.08 }))
  doc.setFontSize(48)
  doc.setFont('helvetica', 'bold')
  doc.text('IOU MAKER', pageWidth / 2, pageHeight / 2, {
    align: 'center',
    angle: 45
  })

  return doc
}

export function downloadInvoicePDF(data: InvoiceData): void {
  const doc = generateInvoicePDF(data)
  const invoiceNumber = data.invoice.number || 'invoice'
  doc.save(`${invoiceNumber}.pdf`)
}