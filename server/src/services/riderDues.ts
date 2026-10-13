// Rider cash dues: the commission on cash trips is owed to the platform (negative wallet balance).
// Past the limit in Settings (`maxCashDues`) the rider is taken offline and cannot go online until they pay.
import type { Types } from 'mongoose'
import { Booking } from '../models/Booking'
import { Driver } from '../models/Driver'
import { emitToRider, removeLiveRider } from '../realtime/socket'
import { roundMoney } from '../utils/http'
import { notifyUser } from '../utils/notify'
import { getPlatformSettings } from '../utils/settings'
import { getOrCreateWallet } from '../utils/wallet'
import { rejectOffer } from './dispatch'

export interface RiderDuesStatus {
  dues: number
  limit: number
  overLimit: boolean
}

export async function getRiderDues(driverId: Types.ObjectId): Promise<RiderDuesStatus> {
  const [wallet, settings] = await Promise.all([getOrCreateWallet('driver', driverId), getPlatformSettings()])
  const dues = roundMoney(Math.max(0, -wallet.balance))
  return { dues, limit: settings.maxCashDues, overLimit: dues > settings.maxCashDues }
}

export const duesLimitMessage = ({ dues, limit }: RiderDuesStatus) =>
  `Your dues of ₹${dues} are over the ₹${limit} limit. Pay your dues to go online.`

/** Takes an online rider whose dues are over the limit offline and alerts them (once, when they go offline). */
export async function enforceDuesLimit(driverId: Types.ObjectId) {
  const status = await getRiderDues(driverId)
  if (!status.overLimit) return status

  const result = await Driver.updateOne({ _id: driverId, onlineStatus: 'online' }, { $set: { onlineStatus: 'offline' } })
  if (!result.modifiedCount) return status
  removeLiveRider(driverId)
  const offered = await Booking.find({ status: 'requested', 'offer.driver': driverId }).select('_id')
  await Promise.all(offered.map((b) => rejectOffer(b.id, driverId.toString())))

  const message = duesLimitMessage(status)
  emitToRider(driverId, 'rider:dues_limit', { ...status, onlineStatus: 'offline', message })
  await notifyUser('driver', driverId, {
    title: 'Dues limit reached',
    body: message,
    data: { type: 'dues_limit', dues: String(status.dues), limit: String(status.limit) },
  })
  return status
}
