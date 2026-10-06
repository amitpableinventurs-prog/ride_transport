import { env } from '../config/env'

export interface SmsProvider {
  name: string
  send(to: string, message: string): Promise<void>
}

// Development provider: prints the message instead of sending it.
// Add a real provider (MSG91, Twilio, ...) here and select it with SMS_PROVIDER.
const consoleProvider: SmsProvider = {
  name: 'console',
  async send(to, message) {
    console.log(`[sms:console] to ${to}: ${message}`)
  },
}

const providers: Record<string, SmsProvider> = {
  console: consoleProvider,
}

export function getSmsProvider(): SmsProvider {
  const provider = providers[env.smsProvider]
  if (!provider) {
    throw new Error(`Unknown SMS_PROVIDER "${env.smsProvider}". Available: ${Object.keys(providers).join(', ')}`)
  }
  if (provider === consoleProvider && env.isProduction) {
    console.warn('[sms] SMS_PROVIDER=console in production: OTPs are only printed to the log, not delivered.')
  }
  return provider
}
