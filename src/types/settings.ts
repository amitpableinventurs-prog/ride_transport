export interface PlatformSettings {
  platformName: string
  supportEmail: string
  supportPhone: string
  defaultCurrency: string
  defaultCountry: string
  rideServiceEnabled: boolean
  transportServiceEnabled: boolean
  maintenanceMode: boolean
  otpExpiryMinutes: number
  accessTokenTtlMinutes: number
  refreshTokenTtlDays: number
  maxCashDues: number
}
