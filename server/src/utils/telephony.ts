import { env } from '../config/env'
import { HttpError } from './http'

export interface MaskedCall {
  /** Number the app dials. */
  number: string
  /** False when the real number is returned (development provider). */
  masked: boolean
  expiresAt?: string
}

export interface TelephonyProvider {
  name: string
  /** A number that connects `from` to `to` for this booking without revealing either side. */
  bridge(bookingId: string, from: string, to: string): Promise<MaskedCall>
}

// Development provider: returns the other party's real number. Add a masked-calling
// provider (Exotel, Knowlarity, Twilio Proxy, ...) here and select it with TELEPHONY_PROVIDER.
const directProvider: TelephonyProvider = {
  name: 'direct',
  async bridge(_bookingId, _from, to) {
    return { number: to, masked: false }
  },
}

const providers: Record<string, TelephonyProvider> = { direct: directProvider }

export function getTelephonyProvider(): TelephonyProvider {
  const provider = providers[env.telephonyProvider]
  if (!provider) throw new Error(`Unknown TELEPHONY_PROVIDER "${env.telephonyProvider}". Available: ${Object.keys(providers).join(', ')}`)
  // Never hand out real numbers in production.
  if (provider === directProvider && env.isProduction) throw new HttpError(503, 'Calling is not available right now')
  return provider
}
