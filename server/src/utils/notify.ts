import type { Types } from 'mongoose'
import { env } from '../config/env'
import { AppNotification } from '../models/AppNotification'
import { Device } from '../models/Device'
import { fcmProvider } from './fcm'
import type { AppUserType } from './jwt'

export interface PushMessage {
  title: string
  body: string
  data?: Record<string, string>
  /** Drop the push if it cannot be delivered within this time (e.g. a booking request after its offer expires). */
  ttlSeconds?: number
}

export interface PushProvider {
  name: string
  /** Sends to devices of one user type; returns tokens that are permanently invalid so they can be removed. */
  send(userType: AppUserType, tokens: string[], message: PushMessage): Promise<{ deadTokens: string[] }>
}

// Development provider: prints pushes. PUSH_PROVIDER=fcm sends through Firebase (src/utils/fcm.ts).
const consoleProvider: PushProvider = {
  name: 'console',
  async send(userType, tokens, message) {
    console.log(`[push:console] to ${tokens.length} ${userType} device(s): ${message.title} — ${message.body}`)
    return { deadTokens: [] }
  },
}

const providers: Record<string, PushProvider> = { console: consoleProvider, fcm: fcmProvider }

function getPushProvider(): PushProvider {
  const provider = providers[env.pushProvider]
  if (!provider) throw new Error(`Unknown PUSH_PROVIDER "${env.pushProvider}". Available: ${Object.keys(providers).join(', ')}`)
  return provider
}

/** Pushes to the given devices and forgets tokens the provider reports as gone. */
export async function pushToTokens(userType: AppUserType, tokens: string[], message: PushMessage) {
  if (!tokens.length) return
  const { deadTokens } = await getPushProvider().send(userType, tokens, message)
  if (deadTokens.length) await Device.deleteMany({ token: { $in: deadTokens } })
}

/** Saves the message to the user's in-app inbox and pushes it to their registered devices. */
export async function notifyUser(userType: AppUserType, userId: Types.ObjectId | string, message: PushMessage) {
  try {
    await AppNotification.create({ userType, userId, title: message.title, body: message.body, data: message.data })
    const tokens = await Device.find({ userType, userId }).distinct('token')
    await pushToTokens(userType, tokens, message)
  } catch (err) {
    // A failed notification must never fail the booking action that triggered it.
    console.error('[notify] failed', err)
  }
}
