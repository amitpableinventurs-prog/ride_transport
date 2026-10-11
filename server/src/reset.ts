// Clears all seeded demo / transactional data so the admin panel reflects only
// the real data created through the mobile apps, while keeping the platform
// configuration the apps and the admin login depend on.
//
//   npm run reset
//
// KEEPS (configuration / access):
//   Roles, Admins (login accounts), Settings, VehicleTypes, ServiceCategories,
//   ServiceAreas, PricingRules, CommissionRules, NotificationTemplates, CmsPages
//
// WIPES (demo entities + their activity):
//   Customers, Drivers (Riders + Drivers), TransportPartners, Vehicles,
//   Bookings, Payments, Refunds, Ratings, Wallets, WalletTransactions, Tickets,
//   SosRequests, Settlements, Withdrawals, CoinTransactions, IncentiveSchemes,
//   DocumentRecords, ChatMessages, AppNotifications, Devices, GatewayOrders,
//   OtpCodes, RevokedTokens, AuditLogs, the seeded DashboardSnapshot,
//   NotificationBroadcasts, Coupons and Banners.
import { connectDb } from './config/db'
import { env } from './config/env'
import mongoose from 'mongoose'

// Demo entities + their activity — safe to delete, recreated by the apps.
import { Customer } from './models/Customer'
import { Driver } from './models/Driver'
import { TransportPartner } from './models/TransportPartner'
import { Vehicle } from './models/Vehicle'
import { Booking } from './models/Booking'
import { Payment } from './models/Payment'
import { Refund } from './models/Refund'
import { Rating } from './models/Rating'
import { Wallet } from './models/Wallet'
import { WalletTransaction } from './models/WalletTransaction'
import { Ticket } from './models/Ticket'
import { SosRequest } from './models/SosRequest'
import { Settlement } from './models/Settlement'
import { Withdrawal } from './models/Withdrawal'
import { CoinTransaction } from './models/CoinTransaction'
import { IncentiveScheme } from './models/IncentiveScheme'
import { DocumentRecord } from './models/Document'
import { ChatMessage } from './models/ChatMessage'
import { AppNotification } from './models/AppNotification'
import { Device } from './models/Device'
import { GatewayOrder } from './models/GatewayOrder'
import { OtpCode } from './models/OtpCode'
import { RevokedToken } from './models/RevokedToken'
import { AuditLog } from './models/AuditLog'
import { DashboardSnapshot } from './models/DashboardSnapshot'
import { NotificationBroadcast } from './models/NotificationBroadcast'
import { Coupon } from './models/Coupon'
import { Banner } from './models/Banner'

// Collections that are left untouched so the platform keeps working.
// Typed loosely: the models have different, incompatible generic signatures,
// and this script only needs countDocuments/deleteMany on each.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const modelsToClear: Array<[string, any]> = [
  ['Customer', Customer],
  ['Driver (Riders + Drivers)', Driver],
  ['TransportPartner', TransportPartner],
  ['Vehicle', Vehicle],
  ['Booking', Booking],
  ['Payment', Payment],
  ['Refund', Refund],
  ['Rating', Rating],
  ['Wallet', Wallet],
  ['WalletTransaction', WalletTransaction],
  ['Ticket', Ticket],
  ['SosRequest', SosRequest],
  ['Settlement', Settlement],
  ['Withdrawal', Withdrawal],
  ['CoinTransaction', CoinTransaction],
  ['IncentiveScheme', IncentiveScheme],
  ['DocumentRecord', DocumentRecord],
  ['ChatMessage', ChatMessage],
  ['AppNotification', AppNotification],
  ['Device', Device],
  ['GatewayOrder', GatewayOrder],
  ['OtpCode', OtpCode],
  ['RevokedToken', RevokedToken],
  ['AuditLog', AuditLog],
  ['DashboardSnapshot', DashboardSnapshot],
  ['NotificationBroadcast', NotificationBroadcast],
  ['Coupon', Coupon],
  ['Banner', Banner],
]

async function reset() {
  if (env.isProduction) {
    throw new Error('Refusing to run the data reset with NODE_ENV=production.')
  }

  try {
    await connectDb()
    console.log(`[reset] connected to ${env.mongoUri}`)
    console.log('[reset] clearing demo / transactional data...')

    let total = 0
    for (const [label, model] of modelsToClear) {
      const before = await model.countDocuments({})
      const result = await model.deleteMany({})
      total += result.deletedCount ?? 0
      console.log(`[reset] ${label.padEnd(28)} removed ${String(result.deletedCount ?? 0).padStart(5)} (was ${before})`)
    }

    console.log(`[reset] done. Removed ${total} documents. Kept roles, admins, settings, categories, areas, pricing, commissions, templates and CMS pages.`)
  } finally {
    await mongoose.disconnect()
  }
}

reset().catch((err) => {
  console.error('[reset] failed', err)
  process.exit(1)
})
