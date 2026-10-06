import { TicketsManager } from './TicketsPage'

// SRS treats "Complaints" and "Tickets" as the same underlying workflow — this
// page renders the same shared ticket-management component as TicketsPage.
export function ComplaintsPage() {
  return <TicketsManager title="Complaints" subtitle="Complaints raised by customers, drivers and partners." />
}
