import { GENDERS, type Gender } from '../models/personalProfile'
import { normalizeIndianMobile } from './phone'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const NAME_MAX = 80
/** Riders/drivers must be adults to drive on the platform. */
export const DRIVER_MIN_AGE = 18

export interface ProfileInput {
  name?: string
  /** null removes the email. */
  email?: string | null
  /** null clears the gender. */
  gender?: Gender | null
  /** null clears the date of birth. */
  dateOfBirth?: Date | null
  emergencyContact?: { name: string; phone: string }
}

interface ParseOptions {
  /** The user's own verified phone; the emergency contact must be someone else. */
  ownPhone: string
  /** Sign-up requires name + emergency contact; profile edits only validate the fields sent. */
  partial: boolean
  minAge?: number
}

type ParseResult = { ok: true; value: ProfileInput } | { ok: false; message: string }

function ageOn(dob: Date, today: Date): number {
  let age = today.getUTCFullYear() - dob.getUTCFullYear()
  const beforeBirthday =
    today.getUTCMonth() < dob.getUTCMonth() || (today.getUTCMonth() === dob.getUTCMonth() && today.getUTCDate() < dob.getUTCDate())
  if (beforeBirthday) age -= 1
  return age
}

function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.trim().replace(/\s+/g, ' ')
  return name.length >= 2 && name.length <= NAME_MAX ? name : null
}

/** Validates the Profile screen fields (name, email, gender, date of birth, emergency contact). */
export function parseProfileInput(body: Record<string, unknown>, opts: ParseOptions): ParseResult {
  const value: ProfileInput = {}
  const has = (key: string) => body[key] !== undefined

  if (has('name') || !opts.partial) {
    const name = cleanName(body.name)
    if (!name) return { ok: false, message: `name is required (2-${NAME_MAX} characters)` }
    value.name = name
  }

  if (has('email')) {
    const raw = typeof body.email === 'string' ? body.email.trim().toLowerCase() : body.email
    if (raw === '' || raw === null) value.email = null
    else if (typeof raw === 'string' && EMAIL_RE.test(raw)) value.email = raw
    else return { ok: false, message: 'Enter a valid email address' }
  }

  if (has('gender')) {
    if (body.gender === null || body.gender === '') value.gender = null
    else if (GENDERS.includes(body.gender as Gender)) value.gender = body.gender as Gender
    else return { ok: false, message: `gender must be one of: ${GENDERS.join(', ')}` }
  }

  if (has('dateOfBirth')) {
    if (body.dateOfBirth === null || body.dateOfBirth === '') {
      value.dateOfBirth = null
    } else {
      const match = typeof body.dateOfBirth === 'string' ? DATE_RE.exec(body.dateOfBirth) : null
      const dob = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null
      // Reject impossible dates like 2001-02-30, which Date.UTC would roll over.
      if (!dob || dob.getUTCDate() !== Number(match![3]) || dob.getUTCFullYear() < 1900) {
        return { ok: false, message: 'dateOfBirth must be a valid date in YYYY-MM-DD format' }
      }
      const age = ageOn(dob, new Date())
      if (age < 0) return { ok: false, message: 'dateOfBirth cannot be in the future' }
      if (opts.minAge && age < opts.minAge) return { ok: false, message: `You must be at least ${opts.minAge} years old` }
      value.dateOfBirth = dob
    }
  }

  if (has('emergencyContact') || !opts.partial) {
    const contact = body.emergencyContact as { name?: unknown; phone?: unknown } | null | undefined
    const name = cleanName(contact?.name)
    const phone = normalizeIndianMobile(contact?.phone)
    if (!contact || typeof contact !== 'object' || !name || !phone) {
      return { ok: false, message: 'emergencyContact with a name and a valid 10-digit mobile number is required' }
    }
    if (phone === opts.ownPhone) {
      return { ok: false, message: 'Emergency contact must be a different phone number from your own' }
    }
    value.emergencyContact = { name, phone }
  }

  return { ok: true, value }
}
