// Seed data for Phase 2-6 collections. Called from seed.ts after the Phase 1
// seed (admins/roles/settings) has run, so Admin documents already exist.
import { VehicleType } from './models/VehicleType'
import { ServiceCategory } from './models/ServiceCategory'
import { ServiceArea } from './models/ServiceArea'
import { Customer } from './models/Customer'
import { Driver } from './models/Driver'
import { TransportPartner } from './models/TransportPartner'
import { Vehicle } from './models/Vehicle'
import { Booking } from './models/Booking'
import { Payment } from './models/Payment'
import { Refund } from './models/Refund'
import { Wallet } from './models/Wallet'
import { WalletTransaction } from './models/WalletTransaction'
import { Rating } from './models/Rating'
import { Ticket } from './models/Ticket'
import { SosRequest } from './models/SosRequest'
import { PricingRule } from './models/PricingRule'
import { CommissionRule } from './models/CommissionRule'
import { Settlement } from './models/Settlement'
import { Coupon } from './models/Coupon'
import { Banner } from './models/Banner'
import { CmsPage } from './models/CmsPage'
import { NotificationTemplate } from './models/NotificationTemplate'
import { NotificationBroadcast } from './models/NotificationBroadcast'
import { Admin } from './models/Admin'

function daysAgo(n: number, hour = 9): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, Math.floor(Math.random() * 60), 0, 0)
  return d
}

export async function seedExtended() {
  const superAdmin = await Admin.findOne({ email: 'super@rideflow.demo' })

  // ---------- Vehicle Types ----------
  const vehicleTypeDefs = [
    { name: 'Bike', serviceMode: 'ride', capacityLabel: '1 seat' },
    { name: 'Scooter', serviceMode: 'ride', capacityLabel: '1 seat' },
    { name: 'Auto', serviceMode: 'ride', capacityLabel: '3 seats' },
    { name: 'Cab', serviceMode: 'ride', capacityLabel: '4 seats' },
    { name: '3-Wheeler', serviceMode: 'transport', capacityLabel: 'up to 300 kg' },
    { name: 'Pickup', serviceMode: 'transport', capacityLabel: '6-14 ft' },
    { name: 'Mini Truck', serviceMode: 'transport', capacityLabel: '16-22 ft' },
    { name: 'Tempo', serviceMode: 'transport', capacityLabel: '16-22 ft' },
    { name: 'Truck', serviceMode: 'transport', capacityLabel: '24-40+ ft' },
    // One type per service category, so a category and its vehicle type share a name.
    { name: 'Cab economy', serviceMode: 'ride', capacityLabel: '4 seats' },
    { name: 'Cab Premium', serviceMode: 'ride', capacityLabel: '4 seats' },
    { name: 'Bike Lite', serviceMode: 'ride', capacityLabel: '1 seat' },
    { name: 'Rental Cars', serviceMode: 'ride', capacityLabel: '4 seats' },
    { name: 'Bike Porter', serviceMode: 'transport', capacityLabel: 'Parcels' },
    { name: 'Small Vehicles', serviceMode: 'transport', capacityLabel: '6-14 ft' },
  ] as const
  const vehicleTypes = new Map<string, any>()
  for (const vt of vehicleTypeDefs) {
    const doc = await VehicleType.findOneAndUpdate({ name: vt.name }, vt, { upsert: true, new: true })
    vehicleTypes.set(vt.name, doc)
  }

  // ---------- Service Categories ----------
  const categoryDefs = [
    { mode: 'ride', key: 'auto', name: 'Auto', description: 'Budget-friendly 3-seater', seats: 3, capacityLabel: undefined, icon: 'car-taxi-front', vehicleType: 'Auto', sortOrder: 1 },
    { mode: 'ride', key: 'cab_economy', name: 'Cab Economy', description: 'Affordable AC cabs', seats: 4, capacityLabel: undefined, icon: 'car', vehicleType: 'Cab economy', sortOrder: 2 },
    { mode: 'ride', key: 'cab_premium', name: 'Cab Premium', description: 'Premium comfort rides', seats: 4, capacityLabel: undefined, icon: 'car-front', vehicleType: 'Cab Premium', sortOrder: 3 },
    { mode: 'ride', key: 'bike', name: 'Bike', description: 'Fastest for solo trips', seats: 1, capacityLabel: undefined, icon: 'bike', vehicleType: 'Bike', sortOrder: 4 },
    { mode: 'ride', key: 'bike_lite', name: 'Bike Lite', description: 'Low-cost solo rides', seats: 1, capacityLabel: undefined, icon: 'bike', vehicleType: 'Bike Lite', sortOrder: 5 },
    { mode: 'ride', key: 'rental_cars', name: 'Rental Cars', description: 'Hourly car rentals with driver', seats: 4, capacityLabel: undefined, icon: 'car', vehicleType: 'Rental Cars', sortOrder: 6 },
    { mode: 'transport', key: 'bike_porter', name: 'Bike Porter', description: 'Parcels, fastest delivery', seats: undefined, capacityLabel: 'Parcels', icon: 'package', vehicleType: 'Bike Porter', sortOrder: 1 },
    { mode: 'transport', key: 'small_vehicle', name: 'Small Vehicles', description: '6-14 ft', seats: undefined, capacityLabel: '6-14 ft', icon: 'truck', vehicleType: 'Small Vehicles', sortOrder: 2 },
    { mode: 'transport', key: 'medium_vehicle', name: 'Medium Vehicles', description: '16-22 ft', seats: undefined, capacityLabel: '16-22 ft', icon: 'truck', vehicleType: 'Mini Truck', sortOrder: 3 },
    { mode: 'transport', key: 'large_vehicle', name: 'Large Vehicles', description: '24-40+ ft', seats: undefined, capacityLabel: '24-40+ ft', icon: 'truck', vehicleType: 'Truck', sortOrder: 4 },
  ] as const
  for (const c of categoryDefs) {
    const { vehicleType, ...rest } = c
    await ServiceCategory.findOneAndUpdate(
      { key: c.key },
      { ...rest, vehicleType: vehicleTypes.get(vehicleType)?._id },
      { upsert: true, new: true },
    )
  }

  // ---------- Service Areas ----------
  const areaDefs = [
    { name: 'Mumbai Metro', country: 'India', state: 'Maharashtra', city: 'Mumbai', zone: 'South Mumbai', geofence: { centerLat: 19.076, centerLng: 72.8777, radiusKm: 25 } },
    { name: 'Bengaluru Metro', country: 'India', state: 'Karnataka', city: 'Bengaluru', zone: 'Central', geofence: { centerLat: 12.9716, centerLng: 77.5946, radiusKm: 30 } },
    { name: 'Delhi NCR', country: 'India', state: 'Delhi', city: 'New Delhi', zone: 'NCR', geofence: { centerLat: 28.7041, centerLng: 77.1025, radiusKm: 40 } },
    { name: 'Indore Metro', country: 'India', state: 'Madhya Pradesh', city: 'Indore', zone: 'Central', geofence: { centerLat: 22.7196, centerLng: 75.8577, radiusKm: 30 } },
    { name: 'Pune Metro', country: 'India', state: 'Maharashtra', city: 'Pune', zone: 'Central', geofence: { centerLat: 18.5204, centerLng: 73.8567, radiusKm: 20 } },
  ]
  const serviceAreas: any[] = []
  for (const a of areaDefs) {
    serviceAreas.push(await ServiceArea.findOneAndUpdate({ name: a.name }, a, { upsert: true, new: true }))
  }

  // ---------- Customers ----------
  const customerNames = [
    'Aarav Patel', 'Meera Joshi', 'Vikram Singh', 'Ishita Rao', 'Devansh Gupta',
    'Kavya Reddy', 'Rohan Malhotra', 'Ananya Desai', 'Aditya Kapoor', 'Sneha Pillai',
  ]
  const customers: any[] = []
  for (let i = 0; i < customerNames.length; i++) {
    const name = customerNames[i]
    const email = `${name.toLowerCase().replace(' ', '.')}@example.com`
    customers.push(
      await Customer.findOneAndUpdate(
        { email },
        {
          name,
          email,
          phone: `+91 90${String(1000000 + i * 137).slice(0, 8)}`,
          status: i === 8 ? 'suspended' : 'active',
          city: areaDefs[i % areaDefs.length].city,
          totalBookings: 5 + i * 3,
          rating: 4 + Math.random() * 0.9,
        },
        { upsert: true, new: true },
      ),
    )
  }

  // ---------- Drivers (Riders + Drivers) ----------
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
  const drivers: any[] = []
  for (let i = 0; i < driverNames.length; i++) {
    const { name, serviceType } = driverNames[i]
    const email = `${name.toLowerCase().replace(' ', '.')}@drivers.rideflow.demo`
    const area = areaDefs[i % areaDefs.length]
    drivers.push(
      await Driver.findOneAndUpdate(
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
            lat: area.geofence.centerLat + (Math.random() - 0.5) * 0.1,
            lng: area.geofence.centerLng + (Math.random() - 0.5) * 0.1,
            updatedAt: new Date(),
          },
          rating: 4 + Math.random() * 0.9,
          totalTrips: 50 + i * 12,
          cancellations: i,
          earnings: 15000 + i * 3200,
        },
        { upsert: true, new: true },
      ),
    )
  }

  // ---------- Transport Partners ----------
  const partnerDefs = [
    { companyName: 'Speedway Logistics', ownerName: 'Ravi Nair', approvalStatus: 'verified' as const, status: 'active' as const },
    { companyName: 'Metro Movers', ownerName: 'Sunita Rao', approvalStatus: 'verified' as const, status: 'active' as const },
    { companyName: 'CargoLink Express', ownerName: 'Farhan Ali', approvalStatus: 'pending' as const, status: 'active' as const },
    { companyName: 'QuickHaul Partners', ownerName: 'Divya Menon', approvalStatus: 'verified' as const, status: 'suspended' as const },
  ]
  const partners: any[] = []
  for (let i = 0; i < partnerDefs.length; i++) {
    const p = partnerDefs[i]
    const email = `${p.companyName.toLowerCase().replace(/\s+/g, '.')}@partners.rideflow.demo`
    partners.push(
      await TransportPartner.findOneAndUpdate(
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
      ),
    )
  }

  // ---------- Vehicles ----------
  const vehicles: any[] = []
  const rideDrivers = drivers.filter((d) => d!.serviceType === 'transport' || d!.serviceType === 'rider')
  for (let i = 0; i < rideDrivers.length; i++) {
    const d = rideDrivers[i]!
    const category = d.serviceType === 'rider' ? categoryDefs[3] : categoryDefs[7]
    const vt = vehicleTypes.get(category.vehicleType)!
    vehicles.push(
      await Vehicle.findOneAndUpdate(
        { registrationNumber: `MH-${(i % 4) + 1}-AB-${1000 + i}` },
        {
          registrationNumber: `MH-${(i % 4) + 1}-AB-${1000 + i}`,
          model: d.serviceType === 'rider' ? 'Honda Activa' : 'Tata Ace',
          manufacturer: d.serviceType === 'rider' ? 'Honda' : 'Tata Motors',
          vehicleType: vt._id,
          serviceMode: category.mode,
          categoryKey: category.key,
          ownerType: 'driver',
          ownerId: d._id,
          ownerModel: 'Driver',
          capacity: category.seats ? `${category.seats} seats` : category.capacityLabel,
          status: 'active',
          documentsStatus: i % 5 === 0 ? 'pending' : 'verified',
        },
        { upsert: true, new: true },
      ),
    )
  }
  for (let i = 0; i < partners.length; i++) {
    const p = partners[i]!
    const category = categoryDefs[7 + (i % 3)]
    const vt = vehicleTypes.get(category.vehicleType)!
    vehicles.push(
      await Vehicle.findOneAndUpdate(
        { registrationNumber: `DL-${i + 1}-TR-${2000 + i}` },
        {
          registrationNumber: `DL-${i + 1}-TR-${2000 + i}`,
          model: 'Tata Ace',
          manufacturer: 'Tata Motors',
          vehicleType: vt._id,
          serviceMode: 'transport',
          categoryKey: category.key,
          ownerType: 'partner',
          ownerId: p._id,
          ownerModel: 'TransportPartner',
          capacity: category.capacityLabel,
          status: 'active',
          documentsStatus: 'verified',
        },
        { upsert: true, new: true },
      ),
    )
  }

  // ---------- Pricing Rules ----------
  const pricingDefs = [
    { categoryKey: 'auto', mode: 'ride', baseFare: 25, perKm: 12, perMinute: 1, minimumFare: 40, cancellationFee: 20 },
    { categoryKey: 'cab_economy', mode: 'ride', baseFare: 40, perKm: 15, perMinute: 1.5, minimumFare: 60, cancellationFee: 30 },
    { categoryKey: 'cab_premium', mode: 'ride', baseFare: 60, perKm: 20, perMinute: 2, minimumFare: 100, cancellationFee: 50 },
    { categoryKey: 'bike', mode: 'ride', baseFare: 15, perKm: 6, perMinute: 0.5, minimumFare: 25, cancellationFee: 10 },
    { categoryKey: 'bike_lite', mode: 'ride', baseFare: 12, perKm: 5, perMinute: 0.4, minimumFare: 20, cancellationFee: 10 },
    { categoryKey: 'rental_cars', mode: 'ride', baseFare: 100, perKm: 18, perMinute: 2, minimumFare: 200, cancellationFee: 60 },
    { categoryKey: 'bike_porter', mode: 'transport', baseFare: 30, perKm: 8, minimumFare: 50, loadingUnloadingCharge: 0, cancellationFee: 20 },
    { categoryKey: 'small_vehicle', mode: 'transport', baseFare: 80, perKm: 18, minimumFare: 150, loadingUnloadingCharge: 50, additionalStopCharge: 20, cancellationFee: 60 },
    { categoryKey: 'medium_vehicle', mode: 'transport', baseFare: 150, perKm: 28, minimumFare: 300, loadingUnloadingCharge: 100, additionalStopCharge: 40, cancellationFee: 120 },
    { categoryKey: 'large_vehicle', mode: 'transport', baseFare: 300, perKm: 45, minimumFare: 600, loadingUnloadingCharge: 200, additionalStopCharge: 80, cancellationFee: 250 },
  ]
  const pricingRules: any[] = []
  for (const p of pricingDefs) {
    pricingRules.push(
      await PricingRule.findOneAndUpdate(
        { categoryKey: p.categoryKey, serviceArea: null },
        { ...p, nightChargeMultiplier: 1.25, platformFeePercent: 5, taxPercent: 5, effectiveFrom: daysAgo(60) },
        { upsert: true, new: true },
      ),
    )
  }

  // ---------- Commission Rules ----------
  await CommissionRule.findOneAndUpdate(
    { appliesTo: 'driver', categoryKey: null },
    { appliesTo: 'driver', type: 'percentage', value: 15, effectiveFrom: daysAgo(60) },
    { upsert: true, new: true },
  )
  await CommissionRule.findOneAndUpdate(
    { appliesTo: 'partner', categoryKey: null },
    { appliesTo: 'partner', type: 'percentage', value: 12, effectiveFrom: daysAgo(60) },
    { upsert: true, new: true },
  )

  // ---------- Bookings + Payments + Refunds + Ratings ----------
  const statuses = ['completed', 'completed', 'completed', 'completed', 'cancelled', 'started', 'in_transit', 'accepted', 'requested'] as const
  const bookings: any[] = []
  for (let i = 0; i < 18; i++) {
    const mode = i % 3 === 0 ? 'transport' : 'ride'
    const categoryPool = mode === 'ride' ? categoryDefs.slice(0, 4) : categoryDefs.slice(4)
    const category = categoryPool[i % categoryPool.length]
    const customer = customers[i % customers.length]!
    const status = statuses[i % statuses.length]
    const isAssigned = status !== 'requested'
    const vehiclePool = vehicles.filter((v) => v!.serviceMode === mode)
    const vehicle = isAssigned && vehiclePool.length ? vehiclePool[i % vehiclePool.length] : null
    const driver = isAssigned && mode === 'ride' ? rideDrivers[i % rideDrivers.length] : null
    const partner = isAssigned && mode === 'transport' ? partners[i % partners.length] : null
    const distanceKm = 3 + (i % 10) * 1.7
    const rule = pricingRules.find((r) => r!.categoryKey === category.key)!
    const base = rule.baseFare
    const distanceFare = Math.round(distanceKm * rule.perKm)
    const total = base + distanceFare + Math.round((base + distanceFare) * 0.05)
    const area = serviceAreas[i % serviceAreas.length]!
    const createdAt = daysAgo(i % 8)

    const booking = await Booking.findOneAndUpdate(
      { bookingCode: `BK-${10201 + i}` },
      {
        bookingCode: `BK-${10201 + i}`,
        mode,
        categoryKey: category.key,
        customer: customer._id,
        driver: driver?._id ?? null,
        vehicle: vehicle?._id ?? null,
        partner: partner?._id ?? null,
        pickup: { address: `${area.city} Pickup Point ${i + 1}`, lat: area.geofence.centerLat + Math.random() * 0.05, lng: area.geofence.centerLng + Math.random() * 0.05 },
        drop: { address: `${area.city} Drop Point ${i + 1}`, lat: area.geofence.centerLat - Math.random() * 0.05, lng: area.geofence.centerLng - Math.random() * 0.05 },
        goodsDetails: mode === 'transport' ? { description: 'Household items', weightKg: 50 + i * 10, notes: '' } : undefined,
        status,
        fare: { base, distance: distanceFare, time: 0, waiting: 0, night: 0, platformFee: Math.round((base + distanceFare) * 0.05), tax: Math.round((base + distanceFare) * 0.05), discount: 0, total },
        distanceKm,
        durationMin: Math.round(distanceKm * 3),
        paymentStatus: status === 'completed' ? 'paid' : status === 'cancelled' ? 'refunded' : 'pending',
        paymentMethod: (['cash', 'upi', 'card', 'wallet'] as const)[i % 4],
        serviceArea: area._id,
        cancellation: status === 'cancelled' ? { by: 'customer', reason: 'Changed plans', chargedAmount: rule.cancellationFee } : undefined,
        timeline: [{ status: 'requested', at: createdAt, note: 'Booking created' }, ...(isAssigned ? [{ status: 'accepted', at: createdAt, note: 'Driver assigned' }] : [])],
        createdAt,
      },
      { upsert: true, new: true },
    )
    bookings.push(booking)

    if (status === 'completed') {
      await Payment.findOneAndUpdate(
        { booking: booking._id },
        { booking: booking._id, amount: total, method: booking.paymentMethod, gateway: booking.paymentMethod === 'cash' ? 'cash' : 'razorpay', status: 'success', createdAt },
        { upsert: true, new: true },
      )
      await Rating.findOneAndUpdate(
        { booking: booking._id, ratedBy: 'customer' },
        { booking: booking._id, customer: customer._id, driver: driver?._id ?? null, ratedBy: 'customer', score: 3 + (i % 3), comment: i % 2 === 0 ? 'Good service' : 'Could be faster', createdAt },
        { upsert: true, new: true },
      )
    }
    if (status === 'cancelled') {
      const payment = await Payment.findOneAndUpdate(
        { booking: booking._id },
        { booking: booking._id, amount: total, method: booking.paymentMethod, gateway: 'razorpay', status: 'refunded', createdAt },
        { upsert: true, new: true },
      )
      await Refund.findOneAndUpdate(
        { booking: booking._id },
        {
          booking: booking._id,
          payment: payment._id,
          amount: total - rule.cancellationFee,
          reason: 'Trip cancelled by customer',
          status: i % 2 === 0 ? 'processed' : 'requested',
          requestedBy: customer.name,
          approvedBy: i % 2 === 0 ? superAdmin?._id : null,
          processedAt: i % 2 === 0 ? createdAt : undefined,
        },
        { upsert: true, new: true },
      )
    }
  }

  // ---------- Wallets + Wallet Transactions ----------
  for (let i = 0; i < 5; i++) {
    const customer = customers[i]!
    const wallet = await Wallet.findOneAndUpdate(
      { ownerType: 'customer', ownerId: customer._id },
      { ownerType: 'customer', ownerId: customer._id, balance: 250 + i * 40 },
      { upsert: true, new: true },
    )
    await WalletTransaction.findOneAndUpdate(
      { wallet: wallet._id, reason: 'recharge' },
      { wallet: wallet._id, type: 'credit', amount: 250 + i * 40, reason: 'recharge', balanceAfter: 250 + i * 40, createdAt: daysAgo(10) },
      { upsert: true, new: true },
    )
  }
  for (let i = 0; i < 6; i++) {
    const driver = drivers[i]!
    const wallet = await Wallet.findOneAndUpdate(
      { ownerType: 'driver', ownerId: driver._id },
      { ownerType: 'driver', ownerId: driver._id, balance: 1200 + i * 300 },
      { upsert: true, new: true },
    )
    await WalletTransaction.findOneAndUpdate(
      { wallet: wallet._id, reason: 'booking_earning' },
      { wallet: wallet._id, type: 'credit', amount: 1200 + i * 300, reason: 'booking_earning', balanceAfter: 1200 + i * 300, createdAt: daysAgo(5) },
      { upsert: true, new: true },
    )
  }
  for (let i = 0; i < partners.length; i++) {
    const partner = partners[i]!
    const wallet = await Wallet.findOneAndUpdate(
      { ownerType: 'partner', ownerId: partner._id },
      { ownerType: 'partner', ownerId: partner._id, balance: 5000 + i * 1200 },
      { upsert: true, new: true },
    )
    await WalletTransaction.findOneAndUpdate(
      { wallet: wallet._id, reason: 'booking_earning' },
      { wallet: wallet._id, type: 'credit', amount: 5000 + i * 1200, reason: 'booking_earning', balanceAfter: 5000 + i * 1200, createdAt: daysAgo(7) },
      { upsert: true, new: true },
    )
  }

  // ---------- Settlements ----------
  for (let i = 0; i < 3; i++) {
    const driver = drivers[i]!
    await Settlement.findOneAndUpdate(
      { payeeType: 'driver', payeeId: driver._id, periodStart: daysAgo(14) },
      {
        payeeType: 'driver',
        payeeId: driver._id,
        periodStart: daysAgo(14),
        periodEnd: daysAgo(7),
        grossEarnings: 8000 + i * 500,
        commissionDeducted: Math.round((8000 + i * 500) * 0.15),
        netPayable: Math.round((8000 + i * 500) * 0.85),
        status: i === 0 ? 'paid' : 'pending',
        paidAt: i === 0 ? daysAgo(6) : undefined,
      },
      { upsert: true, new: true },
    )
  }
  for (let i = 0; i < 2; i++) {
    const partner = partners[i]!
    await Settlement.findOneAndUpdate(
      { payeeType: 'partner', payeeId: partner._id, periodStart: daysAgo(14) },
      {
        payeeType: 'partner',
        payeeId: partner._id,
        periodStart: daysAgo(14),
        periodEnd: daysAgo(7),
        grossEarnings: 22000 + i * 3000,
        commissionDeducted: Math.round((22000 + i * 3000) * 0.12),
        netPayable: Math.round((22000 + i * 3000) * 0.88),
        status: 'pending',
      },
      { upsert: true, new: true },
    )
  }

  // ---------- SOS ----------
  await SosRequest.findOneAndUpdate(
    { userName: 'Ishita Rao', status: 'resolved' },
    {
      booking: bookings[3]?._id,
      raisedBy: 'customer',
      userName: 'Ishita Rao',
      location: { lat: serviceAreas[0]!.geofence.centerLat, lng: serviceAreas[0]!.geofence.centerLng },
      status: 'resolved',
      notes: [{ by: 'Ananya Sharma', text: 'Contacted rider, situation resolved.', at: daysAgo(2) }],
      resolvedAt: daysAgo(2),
    },
    { upsert: true, new: true },
  )
  await SosRequest.findOneAndUpdate(
    { userName: 'Suresh Kumar', status: 'open' },
    {
      raisedBy: 'driver',
      userName: 'Suresh Kumar',
      location: { lat: serviceAreas[1]!.geofence.centerLat, lng: serviceAreas[1]!.geofence.centerLng },
      status: 'open',
      notes: [],
    },
    { upsert: true, new: true },
  )

  // ---------- Tickets ----------
  const ticketDefs = [
    { subject: 'Overcharged for last ride', category: 'payment', raisedByType: 'customer', raisedByName: 'Aarav Patel', status: 'open', priority: 'high' },
    { subject: 'Driver was rude', category: 'driver', raisedByType: 'customer', raisedByName: 'Meera Joshi', status: 'in_progress', priority: 'medium' },
    { subject: 'Lost bag in cab', category: 'lost_item', raisedByType: 'customer', raisedByName: 'Vikram Singh', status: 'assigned', priority: 'high' },
    { subject: 'Refund not received', category: 'refund', raisedByType: 'customer', raisedByName: 'Ishita Rao', status: 'resolved', priority: 'medium' },
    { subject: 'App crashes on booking', category: 'technical', raisedByType: 'customer', raisedByName: 'Devansh Gupta', status: 'closed', priority: 'low' },
    { subject: 'Vehicle AC not working', category: 'vehicle', raisedByType: 'customer', raisedByName: 'Kavya Reddy', status: 'open', priority: 'low' },
  ] as const
  for (const t of ticketDefs) {
    await Ticket.findOneAndUpdate(
      { subject: t.subject },
      {
        ...t,
        notes: t.status === 'resolved' || t.status === 'closed' ? [{ by: 'Karan Mehta', text: 'Issue addressed and closed.', at: daysAgo(1) }] : [],
        resolvedAt: t.status === 'resolved' || t.status === 'closed' ? daysAgo(1) : undefined,
      },
      { upsert: true, new: true },
    )
  }

  // ---------- Coupons + Offers ----------
  await Coupon.findOneAndUpdate(
    { code: 'WELCOME50' },
    { code: 'WELCOME50', title: 'Welcome discount', discountType: 'flat', amount: 50, minBookingAmount: 100, validFrom: daysAgo(30), validTo: daysAgo(-30), usageLimitPerUser: 1, applicableMode: 'both', status: 'active' },
    { upsert: true, new: true },
  )
  await Coupon.findOneAndUpdate(
    { code: 'RIDE20' },
    { code: 'RIDE20', title: '20% off rides', discountType: 'percentage', amount: 20, maxDiscount: 60, minBookingAmount: 80, validFrom: daysAgo(10), validTo: daysAgo(-20), applicableMode: 'ride', status: 'active' },
    { upsert: true, new: true },
  )
  await Coupon.findOneAndUpdate(
    { autoApply: true, title: 'Weekend Transport Offer' },
    { title: 'Weekend Transport Offer', autoApply: true, discountType: 'percentage', amount: 15, maxDiscount: 100, validFrom: daysAgo(5), validTo: daysAgo(-25), applicableMode: 'transport', status: 'active' },
    { upsert: true, new: true },
  )

  // ---------- Banners ----------
  await Banner.findOneAndUpdate(
    { title: 'Moving house? Book a 24-40+ ft vehicle' },
    { title: 'Moving house? Book a 24-40+ ft vehicle', description: 'Get large trucks at flat rates', imageUrl: 'https://placehold.co/800x300', ctaLabel: 'Explore', serviceMode: 'transport', startDate: daysAgo(15), endDate: daysAgo(-45), status: 'active' },
    { upsert: true, new: true },
  )
  await Banner.findOneAndUpdate(
    { title: 'First ride? Get 50 off' },
    { title: 'First ride? Get 50 off', description: 'New user discount', imageUrl: 'https://placehold.co/800x300', ctaLabel: 'Book now', serviceMode: 'ride', startDate: daysAgo(30), endDate: daysAgo(-30), status: 'active' },
    { upsert: true, new: true },
  )

  // ---------- CMS Pages ----------
  const cmsDefs: { slug: string; title: string }[] = [
    { slug: 'about', title: 'About Us' },
    { slug: 'contact', title: 'Contact Us' },
    { slug: 'terms', title: 'Terms & Conditions' },
    { slug: 'privacy', title: 'Privacy Policy' },
    { slug: 'cancellation', title: 'Cancellation Policy' },
    { slug: 'refund', title: 'Refund Policy' },
    { slug: 'rider_terms', title: 'Rider Terms & Conditions' },
    { slug: 'rider_privacy', title: 'Privacy Policy' },
    { slug: 'partner_terms', title: 'Partner Terms' },
    { slug: 'faq', title: 'FAQs' },
  ]
  for (const p of cmsDefs) {
    await CmsPage.findOneAndUpdate(
      { slug: p.slug },
      { slug: p.slug, title: p.title, content: `This is placeholder content for the ${p.title} page. Edit me from the CMS section.`, updatedBy: superAdmin?._id },
      { upsert: true, new: true },
    )
  }

  // ---------- Notification templates + broadcasts ----------
  const templates = [
    { key: 'booking_confirmed', channel: 'push', title: 'Booking confirmed', body: 'Hi {{customer_name}}, your booking {{booking_id}} is confirmed.' },
    { key: 'driver_arriving', channel: 'push', title: 'Driver arriving', body: '{{rider_name}} is arriving in 2 minutes.' },
    { key: 'otp_sms', channel: 'sms', title: undefined, body: 'Your AnZ Cabs OTP is {{otp}}. Valid for 5 minutes.' },
  ] as const
  const savedTemplates = []
  for (const t of templates) {
    savedTemplates.push(await NotificationTemplate.findOneAndUpdate({ key: t.key }, t, { upsert: true, new: true }))
  }
  await NotificationBroadcast.findOneAndUpdate(
    { title: 'Weekend Offer Live!' },
    {
      template: savedTemplates[0]?._id,
      channel: 'push',
      audience: 'all_customers',
      serviceModeFilter: 'both',
      title: 'Weekend Offer Live!',
      body: 'Get flat discounts on rides and deliveries this weekend.',
      sentBy: superAdmin?._id,
      recipientCountEstimate: 48210,
    },
    { upsert: true, new: true },
  )

  console.log('[seedExtended] Phase 2-6 demo data seeded.')
}
