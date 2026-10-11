// Restores ONLY the demo drivers, transport partners and their vehicles — the
// data behind the Fleet → Vehicles page — to exactly the state seedExtended.ts
// creates. Customers, bookings, payments and other transactional demo data are
// left untouched (kept clean for mobile-app testing).
//
//   npm run restore:vehicles
//
// Depends on vehicle types that are never deleted by reset.
import { connectDb } from './config/db'
import { env } from './config/env'
import mongoose from 'mongoose'
import { VehicleType } from './models/VehicleType'
import { Customer } from './models/Customer'
import { Driver } from './models/Driver'
import { TransportPartner } from './models/TransportPartner'
import { Vehicle } from './models/Vehicle'

// Same definitions seedExtended.ts uses (kept in sync so the data matches exactly).
const categoryDefs = [
  { mode: 'ride', key: 'auto', vehicleType: 'Auto', seats: 3 },
  { mode: 'ride', key: 'cab_economy', vehicleType: 'Cab economy', seats: 4 },
  { mode: 'ride', key: 'cab_premium', vehicleType: 'Cab Premium', seats: 4 },
  { mode: 'ride', key: 'bike', vehicleType: 'Bike', seats: 1 },
  { mode: 'ride', key: 'bike_lite', vehicleType: 'Bike Lite', seats: 1 },
  { mode: 'ride', key: 'rental_cars', vehicleType: 'Rental Cars', seats: 4 },
  { mode: 'transport', key: 'bike_porter', vehicleType: 'Bike Porter', capacityLabel: 'Parcels' },
  { mode: 'transport', key: 'small_vehicle', vehicleType: 'Small Vehicles', capacityLabel: '6-14 ft' },
  { mode: 'transport', key: 'medium_vehicle', vehicleType: 'Mini Truck', capacityLabel: '16-22 ft' },
  { mode: 'transport', key: 'large_vehicle', vehicleType: 'Truck', capacityLabel: '24-40+ ft' },
] as const

const areaDefs = [
  { name: 'Mumbai Metro', city: 'Mumbai', centerLat: 19.076, centerLng: 72.8777 },
  { name: 'Bengaluru Metro', city: 'Bengaluru', centerLat: 12.9716, centerLng: 77.5946 },
  { name: 'Delhi NCR', city: 'New Delhi', centerLat: 28.7041, centerLng: 77.1025 },
  { name: 'Indore Metro', city: 'Indore', centerLat: 22.7196, centerLng: 75.8577 },
  { name: 'Pune Metro', city: 'Pune', centerLat: 18.5204, centerLng: 73.8567 },
]

const driverNames = [
  { name: 'Suresh Kumar', serviceType: 'transport' as const },
  { name: 'Manoj Tiwari', serviceType: 'rider' as const },
  { name: 'Ramesh Yadav', serviceType: 'transport' as const },
  { name: 'Ajay Chauhan', serviceType: 'rider' as const },
  { name: 'Vikas Sharma', serviceType: 'transport' as const },
  { name: 'Deepak Verma', serviceType: 'rider' as const },
  { name: 'Sanjay Rathore', serviceType: 'transport' as const },
  { name: 'Naveen Kumar', serviceType: 'rider' as const },
  { name: 'Prakash Jha', serviceType: 'transport' as const },
  { name: 'Rakesh Meena', serviceType: 'rider' as const },
]

const partnerDefs = [
  { companyName: 'Speedway Logistics', ownerName: 'Ravi Nair', approvalStatus: 'verified' as const, status: 'active' as const },
  { companyName: 'Metro Movers', ownerName: 'Sunita Rao', approvalStatus: 'verified' as const, status: 'active' as const },
  { companyName: 'CargoLink Express', ownerName: 'Farhan Ali', approvalStatus: 'pending' as const, status: 'active' as const },
  { companyName: 'QuickHaul Partners', ownerName: 'Divya Menon', approvalStatus: 'verified' as const, status: 'suspended' as const },
]


async function restore() {
  if (env.isProduction) {
    throw new Error('Refusing to run the vehicles restore with NODE_ENV=production.')
  }

  try {
    await connectDb()
    console.log(`[restore:vehicles] connected to ${env.mongoUri}`)

    // Look up the platform config the vehicles reference (never deleted by reset).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vehicleTypes = new Map<string, any>()
    for (const vt of await VehicleType.find({})) vehicleTypes.set(vt.name, vt)
    const requiredVehicleTypes = new Set(categoryDefs.map((category) => category.vehicleType))
    const missingVehicleTypes = [...requiredVehicleTypes].filter((name) => !vehicleTypes.has(name))
    if (missingVehicleTypes.length) {
      throw new Error(`Missing vehicle types: ${missingVehicleTypes.join(', ')}. Run \`npm run seed\` first.`)
    }

  // ---------- A few customers (kept minimal; transactional demo data stays clean) ----------
  const customerNames = ['Aarav Patel', 'Meera Joshi', 'Vikram Singh', 'Ishita Rao', 'Devansh Gupta']
  for (let i = 0; i < customerNames.length; i++) {
    const name = customerNames[i]!
    const email = `${name.toLowerCase().replace(' ', '.')}@example.com`
    await Customer.findOneAndUpdate(
      { email },
      {
        name,
        email,
        phone: `+91 90${String(1000000 + i * 137).slice(0, 8)}`,
        status: 'active',
        city: areaDefs[i % areaDefs.length]!.city,
      },
      { upsert: true, new: true },
    )
  }

  // ---------- Drivers (Riders + Drivers) ----------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drivers: any[] = []
  for (let i = 0; i < driverNames.length; i++) {
    const { name, serviceType } = driverNames[i]!
    const email = `${name.toLowerCase().replace(' ', '.')}@drivers.rideflow.demo`
    const area = areaDefs[i % areaDefs.length]!
    const driver = await Driver.findOneAndUpdate(
      { email },
      {
        name,
        email,
        phone: `+91 91${String(2000000 + i * 219).slice(0, 8)}`,
        serviceType,
        approvalStatus: i === 9 ? 'pending' : 'verified',
        status: i === 7 ? 'suspended' : 'active',
        onlineStatus: i < 6 ? 'online' : i === 6 ? 'busy' : 'offline',
        currentLocation: {
          lat: area.centerLat + (i % 3 - 1) * 0.02,
          lng: area.centerLng + (i % 2) * 0.02,
          updatedAt: new Date(),
        },
        rating: 4 + (i % 5) * 0.18,
        totalTrips: 50 + i * 12,
        cancellations: i,
        earnings: 15000 + i * 3200,
      },
      { upsert: true, new: true },
    )
    drivers.push(driver)
  }

  // ---------- Transport Partners ----------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const partners: any[] = []
  for (let i = 0; i < partnerDefs.length; i++) {
    const p = partnerDefs[i]!
    const email = `${p.companyName.toLowerCase().replace(/\s+/g, '.')}@partners.rideflow.demo`
    const partner = await TransportPartner.findOneAndUpdate(
      { email },
      {
        ...p,
        email,
        phone: `+91 92${String(3000000 + i * 341).slice(0, 8)}`,
        businessRegNo: `REG-${1000 + i}`,
        taxId: `TAX-${5000 + i}`,
        vehicleCount: 3 + i,
        driverCount: 2 + i,
      },
      { upsert: true, new: true },
    )
    partners.push(partner)
  }

  // ---------- Vehicles ----------
  const rideDrivers = drivers.filter((d) => d.serviceType === 'rider' || d.serviceType === 'transport')
  let created = 0
  for (let i = 0; i < rideDrivers.length; i++) {
    const d = rideDrivers[i]!
    const def = d.serviceType === 'rider' ? categoryDefs[3]! : categoryDefs[7]!
    const vt = vehicleTypes.get(def.vehicleType)!
    await Vehicle.findOneAndUpdate(
      { registrationNumber: `MH-${(i % 4) + 1}-AB-${1000 + i}` },
      {
        registrationNumber: `MH-${(i % 4) + 1}-AB-${1000 + i}`,
        model: d.serviceType === 'rider' ? 'Honda Activa' : 'Tata Ace',
        manufacturer: d.serviceType === 'rider' ? 'Honda' : 'Tata Motors',
        vehicleType: vt._id,
        serviceMode: def.mode,
        categoryKey: def.key,
        ownerType: 'driver',
        ownerId: d._id,
        ownerModel: 'Driver',
        capacity: 'seats' in def ? `${def.seats} seats` : def.capacityLabel,
        status: 'active',
        documentsStatus: i % 5 === 0 ? 'pending' : 'verified',
      },
      { upsert: true, new: true },
    )
    created++
  }
  for (let i = 0; i < partners.length; i++) {
    const p = partners[i]!
    const def = categoryDefs[7 + (i % 3)]!
    const vt = vehicleTypes.get(def.vehicleType)!
    const capacity = 'seats' in def ? `${def.seats} seats` : def.capacityLabel
    await Vehicle.findOneAndUpdate(
      { registrationNumber: `DL-${i + 1}-TR-${2000 + i}` },
      {
        registrationNumber: `DL-${i + 1}-TR-${2000 + i}`,
        model: 'Tata Ace',
        manufacturer: 'Tata Motors',
        vehicleType: vt._id,
        serviceMode: def.mode,
        categoryKey: def.key,
        ownerType: 'partner',
        ownerId: p._id,
        ownerModel: 'TransportPartner',
        capacity,
        status: 'active',
        documentsStatus: 'verified',
      },
      { upsert: true, new: true },
    )
    created++
  }

    console.log(`[restore:vehicles] done. Drivers: ${drivers.length}, Partners: ${partners.length}, Vehicles upserted: ${created}.`)
    console.log('[restore:vehicles] Note: the demo drivers/partners reappear on the Riders/Drivers/Partners pages (they own these vehicles). Bookings, payments and other transactional demo data were left untouched.')
  } finally {
    await mongoose.disconnect()
  }
}

restore().catch((err) => {
  console.error('[restore:vehicles] failed', err)
  process.exit(1)
})

