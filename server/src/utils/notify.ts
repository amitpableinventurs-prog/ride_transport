import type { Types } from 'mongoose'
import { env } from '../config/env'
import { AppNotification } from '../models/AppNotification'
import { Device } from '../models/Device'

export interface PushMessage {
  title: string
  body: string
  data?: Record<string, string>
}

export interface PushProvider {
  name: string
  send(tokens: string[], message: PushMessage): Promise<void>
}

// Development provider: prints pushes. Add FCM (firebase-admin) here and select it with PUSH_PROVIDER.
const consoleProvider: PushProvider = {
  name: 'console',
  async send(tokens, message) {
    console.log(`[push:console] to ${tokens.length} device(s): ${message.title} — ${message.body}`)
  },
}

const providers: Record<string, PushProvider> = { console: consoleProvider }

function getPushProvider(): PushProvider {
  const provider = providers[env.pushProvider]
  if (!provider) throw new Error(`Unknown PUSH_PROVIDER "${env.pushProvider}". Available: ${Object.keys(providers).join(', ')}`)
  return provider
}

type AppUserType = 'customer' | 'driver' | 'partner'

/** Saves the message to the user's in-app inbox and pushes it to their registered devices. */
export async function notifyUser(userType: AppUserType, userId: Types.ObjectId | string, message: PushMessage) {
  try {
    await AppNotification.create({ userType, userId, title: message.title, body: message.body, data: message.data })
    const tokens = await Device.find({ userType, userId }).distinct('token')
    if (tokens.length) await getPushProvider().send(tokens, message)
  } catch (err) {
    // A failed notification must never fail the booking action that triggered it.
    console.error('[notify] failed', err)
  }
}
