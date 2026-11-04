'use client'
import { EntryDialog } from '../../components/EntryDialog'

/** Add a day to the itinerary, or an item to an existing day. */
export function AddDay({ tripId }: { tripId: string }) {
  return <EntryDialog title="Add itinerary day" trigger="Add day" operator="addItineraryDay" base={{ tripId }} fields={[{ name: 'title', label: 'Day title' }, { name: 'date', label: 'Date', kind: 'date' }]} />
}
export function AddItem({ tripId, dayId }: { tripId: string; dayId: string }) {
  return <EntryDialog title="Add itinerary item" trigger="Add item" operator="addItineraryItem" base={{ tripId, dayId }} fields={[{ name: 'title', label: 'Title' }, { name: 'time', label: 'Time (for example 09:30)', optional: true }, { name: 'location', label: 'Location', optional: true }, { name: 'notes', label: 'Notes', optional: true }]} />
}
