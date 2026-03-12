export interface LineItem {
  description: string
  quantity: number
  rate: number
}

export interface BusinessInfo {
  name: string
  email: string
  phone: string
  website: string
  address: string
}

export interface ClientInfo {
  name: string
  email: string
  address: string
}

export interface InvoiceDetails {
  number: string
  issueDate: string
  dueDate: string
}

export interface InvoiceSettings {
  currency: string
  taxRate: number
  discount: number
}

export interface InvoiceNotes {
  paymentTerms: string
  thankYou: string
}

export interface InvoiceData {
  business: BusinessInfo
  client: ClientInfo
  invoice: InvoiceDetails
  settings: InvoiceSettings
  lineItems: LineItem[]
  notes: InvoiceNotes
}