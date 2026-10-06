// Temporary local-demo bootstrap: this machine has no MongoDB installed,
// so this spins up an in-memory MongoDB, seeds it, and starts the real API
// on it. Not part of the app — safe to delete; use `npm run seed` + `npm run dev`
// against a real MONGODB_URI for actual development.
import { MongoMemoryServer } from 'mongodb-memory-server'

async function main() {
  const mongod = await MongoMemoryServer.create()
  process.env.MONGODB_URI = mongod.getUri('rideflow_admin_demo')

  const { connectDb } = await import('./config/db')
  await connectDb()

  const { Role } = await import('./models/Role')
  const { Admin } = await import('./models/Admin')
  const { Settings } = await import('./models/Settings')
  const { DashboardSnapshot } = await import('./models/DashboardSnapshot')
  const { hashPassword } = await import('./utils/password')
  const { ROLE_SEED } = await import('./utils/roles')
  const { env } = await import('./config/env')

  for (const role of ROLE_SEED) {
    await Role.findOneAndUpdate({ key: role.key }, role, { upsert: true, new: true })
  }

  const passwordHash = await hashPassword(env.seedAdminPassword)
  const seedAdmins = [
    { name: 'Ananya Sharma', email: 'super@rideflow.demo', phone: '+91 98200 11223', role: 'super_admin', avatarColor: '#1f2f52' },
    { name: 'Rohit Verma', email: 'ops@rideflow.demo', phone: '+91 98200 33445', role: 'operations_admin', avatarColor: '#f5820c' },
    { name: 'Priya Nair', email: 'finance@rideflow.demo', phone: '+91 98200 55667', role: 'finance_admin', avatarColor: '#16a34a' },
    { name: 'Karan Mehta', email: 'support@rideflow.demo', phone: '+91 98200 77889', role: 'support_admin', avatarColor: '#0f7a37' },
    { name: 'Sneha Iyer', email: 'content@rideflow.demo', phone: '+91 98200 99001', role: 'content_admin', avatarColor: '#7e93ba' },
  ] as const
  for (const seedAdmin of seedAdmins) {
    await Admin.create({ ...seedAdmin, passwordHash, status: 'active' })
  }

  await Settings.create({ singleton: 'platform' })
  await DashboardSnapshot.create({
    singleton: 'latest',
    totals: { customers: 48210, riders: 3120, drivers: 1890, transportPartners: 412, vehicles: 5230 },
    today: { bookings: 2140, ongoingRides: 186, activeDeliveries: 94, completed: 1790, cancelled: 70 },
    revenue: { todayRevenue: 812430, platformCommission: 121864, partnerEarnings: 690566, refunds: 8420 },
    serviceSplit: [
      { label: 'Ride', value: 68 },
      { label: 'Transport', value: 32 },
    ],
    bookingStatusDistribution: [
      { label: 'Completed', value: 1790, color: '#16a34a' },
      { label: 'Ongoing', value: 186, color: '#f5820c' },
      { label: 'Cancelled', value: 70, color: '#dc2626' },
      { label: 'Pending', value: 94, color: '#4a5f8f' },
    ],
    revenueTrend: [
      { day: 'Mon', revenue: 612000 },
      { day: 'Tue', revenue: 654000 },
      { day: 'Wed', revenue: 598000 },
      { day: 'Thu', revenue: 723000 },
      { day: 'Fri', revenue: 781000 },
      { day: 'Sat', revenue: 902000 },
      { day: 'Sun', revenue: 812430 },
    ],
    recentBookings: [
      { id: 'BK-10231', customer: 'Aarav Patel', mode: 'Ride', category: 'Cab Economy', status: 'Completed', fare: 245, createdAt: '2026-09-16T08:12:00Z' },
      { id: 'BK-10230', customer: 'Meera Joshi', mode: 'Transport', category: 'Small Vehicles', status: 'In Transit', fare: 890, createdAt: '2026-09-16T07:58:00Z' },
      { id: 'BK-10229', customer: 'Vikram Singh', mode: 'Ride', category: 'Auto', status: 'Ongoing', fare: 110, createdAt: '2026-09-16T07:50:00Z' },
      { id: 'BK-10228', customer: 'Ishita Rao', mode: 'Ride', category: 'Bike', status: 'Cancelled', fare: 0, createdAt: '2026-09-16T07:41:00Z' },
      { id: 'BK-10227', customer: 'Devansh Gupta', mode: 'Transport', category: 'Bike Porter', status: 'Delivered', fare: 180, createdAt: '2026-09-16T07:20:00Z' },
      { id: 'BK-10226', customer: 'Kavya Reddy', mode: 'Ride', category: 'Cab Premium', status: 'Completed', fare: 410, createdAt: '2026-09-16T07:05:00Z' },
    ],
    pendingApprovals: [
      { id: 'PA-001', type: 'Driver', name: 'Suresh Kumar', submittedAt: '2026-09-15T18:00:00Z' },
      { id: 'PA-002', type: 'Rider', name: 'Manoj Tiwari', submittedAt: '2026-09-15T16:30:00Z' },
      { id: 'PA-003', type: 'Transport Partner', name: 'Speedway Logistics', submittedAt: '2026-09-14T11:00:00Z' },
    ],
    alerts: [
      { id: 'AL-001', type: 'sos', message: 'SOS triggered on booking BK-10199', severity: 'high', createdAt: '2026-09-16T08:02:00Z' },
      { id: 'AL-002', type: 'document', message: '14 driver documents expiring within 7 days', severity: 'medium', createdAt: '2026-09-16T06:00:00Z' },
      { id: 'AL-003', type: 'payment', message: '3 payment captures failed in the last hour', severity: 'medium', createdAt: '2026-09-16T07:30:00Z' },
    ],
  })

  const { seedExtended } = await import('./seedExtended')
  await seedExtended()

  console.log(`[dev-memory] seeded in-memory MongoDB at ${process.env.MONGODB_URI}`)

  const { app } = await import('./app')
  app.listen(env.port, () => {
    console.log(`[dev-memory] API listening on http://localhost:${env.port}`)
  })
}

main().catch((err) => {
  console.error('[dev-memory] failed to start', err)
  process.exit(1)
})
