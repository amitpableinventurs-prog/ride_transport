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
  adminLoginOtpEnabled: boolean
  accessTokenTtlMinutes: number
  refreshTokenTtlDays: number
}
