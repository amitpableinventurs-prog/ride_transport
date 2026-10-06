import { BookingsListView } from './BookingsPage'

export function ActiveRidesPage() {
  return (
    <BookingsListView
      title="Active Rides"
      subtitle="Ride bookings that are currently accepted, arriving or in progress."
      fixedMode="ride"
      fixedStatus="accepted,arriving,started"
      showModeFilter={false}
      showStatusFilter={false}
    />
  )
}
