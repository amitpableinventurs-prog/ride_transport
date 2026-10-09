import fs from 'fs'
import path from 'path'
import { cert, initializeApp, type App } from 'firebase-admin/app'
import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging'
import { env } from '../config/env'
import type { AppUserType } from './jwt'
import type { PushMessage, PushProvider } from './notify'

// The customer app and the rider app are separate Firebase projects, so a device token only works with
// the service account of the project its app belongs to. Devices are stored with the user type, which picks it.
type FirebaseProject = 'customer' | 'rider'

const PROJECT_FOR_USER: Partial<Record<AppUserType, FirebaseProject>> = { customer: 'customer', driver: 'rider' }

// Android notification channels the apps create (high importance for booking requests).
export const ANDROID_CHANNELS = { bookingRequests: 'booking_requests', general: 'general' } as const

// FCM accepts at most 500 tokens per multicast call.
const MULTICAST_LIMIT = 500

// Tokens FCM will never deliver to again (app uninstalled, token rotated).
const DEAD_TOKEN_ERRORS = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'])

const apps = new Map<FirebaseProject, App | null>()

/** FIREBASE_*_SERVICE_ACCOUNT is a path to the service account JSON file, or the JSON itself. */
function loadServiceAccount(setting: string) {
  const text = setting.trim().startsWith('{') ? setting : fs.readFileSync(path.resolve(setting), 'utf8')
  return JSON.parse(text)
}

function appFor(project: FirebaseProject): App | null {
  if (!apps.has(project)) {
    const name = `FIREBASE_${project.toUpperCase()}_SERVICE_ACCOUNT`
    const setting = project === 'rider' ? env.fcmRiderServiceAccount : env.fcmCustomerServiceAccount
    let app: App | null = null
    if (!setting) console.warn(`[push:fcm] ${name} is not set; ${project} app pushes are skipped`)
    else {
      try {
        app = initializeApp({ credential: cert(loadServiceAccount(setting)) }, `fcm-${project}`)
      } catch (err) {
        // Logged once; fix the key and restart the server.
        console.error(`[push:fcm] ${name} could not be loaded; ${project} app pushes are skipped:`, (err as Error).message)
      }
    }
    apps.set(project, app)
  }
  return apps.get(project)!
}

function buildMessage(tokens: string[], message: PushMessage): MulticastMessage {
  const isBookingRequest = message.data?.type === 'booking_request'
  return {
    tokens,
    notification: { title: message.title, body: message.body },
    data: message.data,
    android: {
      priority: 'high',
      ...(message.ttlSeconds ? { ttl: message.ttlSeconds * 1000 } : {}),
      notification: { channelId: isBookingRequest ? ANDROID_CHANNELS.bookingRequests : ANDROID_CHANNELS.general, sound: 'default' },
    },
    apns: {
      headers: {
        'apns-priority': '10',
        ...(message.ttlSeconds ? { 'apns-expiration': String(Math.floor(Date.now() / 1000) + message.ttlSeconds) } : {}),
      },
      payload: { aps: { sound: 'default' } },
    },
  }
}

export const fcmProvider: PushProvider = {
  name: 'fcm',
  async send(userType, tokens, message) {
    const project = PROJECT_FOR_USER[userType]
    const app = project ? appFor(project) : null
    if (!app) return { deadTokens: [] }

    const deadTokens: string[] = []
    for (let i = 0; i < tokens.length; i += MULTICAST_LIMIT) {
      const batch = tokens.slice(i, i + MULTICAST_LIMIT)
      const result = await getMessaging(app).sendEachForMulticast(buildMessage(batch, message))
      result.responses.forEach((r, j) => {
        if (r.success) return
        if (r.error && DEAD_TOKEN_ERRORS.has(r.error.code)) deadTokens.push(batch[j])
        else console.error(`[push:fcm] ${project} send failed: ${r.error?.code} ${r.error?.message}`)
      })
    }
    return { deadTokens }
  },
}
