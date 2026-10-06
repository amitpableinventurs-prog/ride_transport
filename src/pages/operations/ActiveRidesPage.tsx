import { BookingsListView } from './BookingsPage'

export function ActiveRidesPage() {
  return (
    <BookingsListView
      title="Active Rides"
      subtitle="Ride bookings that are currently accepted, arriving, at pickup or in progress."
      fixedMode="ride"
      fixedStatus="accepted,arriving,arrived,started"
      showModeFilter={false}
      showStatusFilter={false}
    />
  )
}
