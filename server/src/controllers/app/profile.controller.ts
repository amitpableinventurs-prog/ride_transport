import type { Request, Response } from 'express'
import { serializeAppUser } from '../../utils/appUsers'
import { DRIVER_MIN_AGE, parseProfileInput } from '../../utils/profileInput'
import { normalizeIndianMobile } from '../../utils/phone'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

// GET /profile
export async function getProfile(req: Request, res: Response) {
  res.json(serializeAppUser(req.appUser!))
}

// PATCH /profile: send only the fields that changed.
export async function updateProfile(req: Request, res: Response) {
  const user = req.appUser!
  const body = req.body as Record<string, unknown>

  // The phone number is the login identity verified by OTP; the app may echo it back but not change it here.
  if (body.phone !== undefined && normalizeIndianMobile(body.phone) !== user.doc.phone) {
    res.status(400).json({ message: 'Phone number cannot be changed from the profile' })
    return
  }

  if (user.type === 'partner') {
    const email = body.email === undefined ? undefined : optionalString(body.email)?.toLowerCase() ?? null
    if (email && !EMAIL_RE.test(email)) {
      res.status(400).json({ message: 'Enter a valid email address' })
      return
    }
    for (const key of ['companyName', 'ownerName'] as const) {
      if (body[key] === undefined) continue
      const value = optionalString(body[key])
      if (!value) {
        res.status(400).json({ message: `${key} cannot be empty` })
        return
      }
      user.doc.set(key, value)
    }
    for (const key of ['businessRegNo', 'taxId'] as const) {
      if (body[key] !== undefined) user.doc.set(key, optionalString(body[key]))
    }
    if (email !== undefined) user.doc.set('email', email ?? undefined)
    await user.doc.save()
    res.json(serializeAppUser(user))
    return
  }

  const parsed = parseProfileInput(body, {
    ownPhone: user.doc.phone,
    partial: true,
    minAge: user.type === 'driver' ? DRIVER_MIN_AGE : undefined,
  })
  if (!parsed.ok) {
    res.status(400).json({ message: parsed.message })
    return
  }

  // null means "clear this field".
  for (const [key, value] of Object.entries(parsed.value)) {
    user.doc.set(key, value ?? undefined)
  }
  if (user.type === 'customer' && body.city !== undefined) {
    user.doc.set('city', optionalString(body.city))
  }

  await user.doc.save()
  res.json(serializeAppUser(user))
}
