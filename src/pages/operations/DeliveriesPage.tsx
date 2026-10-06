import { BookingsListView } from './BookingsPage'

export function DeliveriesPage() {
  return (
    <BookingsListView
      title="Deliveries"
      subtitle="Transport bookings that are currently accepted, arriving or in transit."
      fixedMode="transport"
      fixedStatus="accepted,arriving,arrived,started,in_transit"
      showModeFilter={false}
      showStatusFilter={false}
    />
  )
}
