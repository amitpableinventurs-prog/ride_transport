import { Schema, model, type InferSchemaType } from 'mongoose'

// Phase 1 stand-in: dashboard figures are stored as a seeded snapshot until
// Bookings/Customers/Vehicles collections (Phase 2-3) exist to aggregate from.
const dashboardSnapshotSchema = new Schema(
  {
    singleton: { type: String, required: true, unique: true, default: 'latest' },
    totals: {
      customers: Number,
      riders: Number,
      drivers: Number,
      transportPartners: Number,
      vehicles: Number,
    },
    today: {
      bookings: Number,
      ongoingRides: Number,
      activeDeliveries: Number,
      completed: Number,
      cancelled: Number,
    },
    revenue: {
      todayRevenue: Number,
      platformCommission: Number,
      partnerEarnings: Number,
      refunds: Number,
    },
    serviceSplit: [{ label: String, value: Number }],
    bookingStatusDistribution: [{ label: String, value: Number, color: String }],
    revenueTrend: [{ day: String, revenue: Number }],
    recentBookings: [
      {
        id: String,
        customer: String,
        mode: String,
        category: String,
        status: String,
        fare: Number,
        createdAt: String,
      },
    ],
    // `type: { type: String }` (not `type: String`) because Mongoose reserves a
    // sibling key literally named "type" as its own SchemaType shorthand — without
    // the wrapper it reinterprets the whole subdocument as a plain [String] array.
    pendingApprovals: [{ id: String, type: { type: String }, name: String, submittedAt: String }],
    alerts: [{ id: String, type: { type: String }, message: String, severity: String, createdAt: String }],
  },
  { timestamps: true },
)

export type DashboardSnapshotDocument = InferSchemaType<typeof dashboardSnapshotSchema>
export const DashboardSnapshot = model('DashboardSnapshot', dashboardSnapshotSchema)
