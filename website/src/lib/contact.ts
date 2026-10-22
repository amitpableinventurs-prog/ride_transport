import { Mail, MapPin, MessageCircle, Phone, type LucideIcon } from 'lucide-react'
import { site } from '@/config'

export interface ContactChannel {
  icon: LucideIcon
  label: string
  text: string
  href?: string
}

/** The ways to reach us that are filled in `site.contact`, in display order. */
export function contactChannels(): ContactChannel[] {
  const { phone, email, whatsapp, address } = site.contact
  const channels: ContactChannel[] = []
  if (phone) channels.push({ icon: Phone, label: 'Call us', text: phone, href: `tel:${phone.replace(/\s+/g, '')}` })
  if (whatsapp) channels.push({ icon: MessageCircle, label: 'WhatsApp', text: 'WhatsApp us', href: `https://wa.me/${whatsapp.replace(/\D/g, '')}` })
  if (email) channels.push({ icon: Mail, label: 'Email', text: email, href: `mailto:${email}` })
  if (address) channels.push({ icon: MapPin, label: 'Office', text: address })
  return channels
}
