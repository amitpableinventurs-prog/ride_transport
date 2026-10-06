import type { Request, Response } from 'express'
import { Settings } from '../models/Settings'
import { recordAudit } from '../utils/audit'

async function getOrCreateSettings() {
  const existing = await Settings.findOne({ singleton: 'platform' })
  if (existing) return existing
  return Settings.create({ singleton: 'platform' })
}

export async function getSettings(_req: Request, res: Response) {
  res.json(await getOrCreateSettings())
}

export async function updateSettings(req: Request, res: Response) {
  const settings = await getOrCreateSettings()
  const body = req.body as Record<string, unknown>

  const allowedKeys = [
    'platformName',
    'supportEmail',
    'supportPhone',
    'defaultCurrency',
    'defaultCountry',
    'rideServiceEnabled',
    'transportServiceEnabled',
    'maintenanceMode',
    'otpExpiryMinutes',
    'adminLoginOtpEnabled',
    'accessTokenTtlMinutes',
    'refreshTokenTtlDays',
    'dispatchRadiusKm',
    'riderRequestTimeoutSeconds',
    'maxDispatchAttempts',
    'scheduleLeadMinutes',
    'freeCancellationMinutes',
    'freeWaitingMinutes',
    'selfieCheckIntervalHours',
    'maxCashDues',
    'minWithdrawalAmount',
    'customerAppMinVersion',
    'riderAppMinVersion',
  ] as const

  const mutableSettings = settings as unknown as Record<string, unknown>
  for (const key of allowedKeys) {
    if (body[key] !== undefined) {
      mutableSettings[key] = body[key]
    }
  }
  await settings.save()

  await recordAudit(req.admin!, 'settings.updated', 'PlatformSettings', 'Platform Settings')

  res.json(settings)
}
