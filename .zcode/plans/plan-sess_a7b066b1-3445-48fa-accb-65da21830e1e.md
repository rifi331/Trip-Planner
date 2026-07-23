# Plan: Bug fixes + mobile support + AI category filter (v0.2.0)

Same plan as before, with the shake feedback added to #5.

## Bug fixes (critical)

### #1 Day-offset (drops land on previous day)
**Root cause:** `TimelineColumn.tsx:23-24` stores `day.toISOString()` — converting local-midnight to UTC shifts the calendar day for non-UTC timezones (MYT +08:00 → previous day).
**Fix:** Carry days as timezone-safe local `YYYY-MM-DD` strings.
- Add `toLocalDateKey(date): string` + `fromLocalDateKey(key): Date` in `lib/date-utils.ts`.
- `TimelineColumn`: droppable id + `data.current.day` = `toLocalDateKey(day)`.
- `TripDetailClient.onDragEnd`: `const day = fromLocalDateKey(dayIso)`. Slot math stays.

### #2 Drag handle = whole card on placed cards
**Root cause:** `PlacedCard.tsx:97-98` spreads listeners on the outer div.
**Fix:** Move listeners onto a dedicated grip button (like `PoolCard`), enlarge to a real touch target.

### Pool unassign drop is broken (bonus fix)
**Root cause:** `CardPool` sets an HTML attr but no real `useDroppable`.
**Fix:** Wrap pool list in `useDroppable({ id: "pool", data: { type: "pool" } })`.

## New features

### #3 Click-to-place (tap slot → pick card)
- Empty slots in `TimelineColumn` become tap targets. Tapping sets a "pending slot" `{ dayKey, slotIndex }` in `TripDetailClient`.
- Pool cards show a "Place here" affordance; tapping a pool card places it at the pending slot via itinerary POST. A banner shows "Tap a card to place at Tue 28 Jul, 09:00 — Cancel".
- Works on desktop AND phone — the mobile primary method.

### #4 Slider reflects stretched (slot) duration
**Root cause:** modal slider edits `defaultDurationMinutes`, not the placed slot's `durationMinutes`.
**Fix:** When editing a placed card (`editingCard.itinerarySlot` exists), modal shows/edits the **slot** duration via PATCH and labels it "Scheduled duration". Otherwise edits `defaultDurationMinutes`. Add optional `slotDuration` prop.

### #5 Mobile: 2-second-hold drag (TouchSensor) + shake feedback
- Add `TouchSensor` with `activationConstraint: { delay: 2000, tolerance: 5 }` in `TripDetailClient`.
- **Shake animation:** add a `@keyframes wiggle` in `globals.css` and a `.wiggle` class. When a drag becomes active (`isDragging` true from `useDraggable`/`useSortable`, OR during the 2s hold — detected via `onDragStart`), apply `.wiggle` to the dragged card overlay + the active card. The `DragOverlay` card also wiggles so the user sees "it's now movable". When dropped/cancelled, wiggle stops.
- Enlarge drag handles to ~36px touch targets.
- Drop the global `pointermove` tracker; compute slot from `e.over.rect` + `e.delta.y`.

### #6 Mobile: scale-down side-by-side layout
- Pool: `w-80` desktop → `w-44` mobile (smaller thumbnails).
- Day columns: `180px` → `120px` mobile, horizontally scrollable.
- Larger tap targets, smaller header on mobile.

## Nice-to-have #1: AI multi-select category chips
- `GenerateButton` adds toggle chips (all 8 categories, all selected by default). Selected categories POSTed as `{ categories: [...] }`.
- API route parses body, validates, threads `categories?: CardCategory[]` into `generateCardsFromAI`.
- `lib/openai.ts`: when categories provided, narrow prompt + narrow JSON schema `enum` to selected set.

## Files changed
- `lib/date-utils.ts` — `toLocalDateKey`, `fromLocalDateKey`
- `components/TimelineColumn.tsx` — day key, slot tap targets, responsive width, droppable data
- `components/TripDetailClient.tsx` — TouchSensor, day-key parse, click-to-place state, pool droppable, slot math via delta, wiggle state
- `components/CardPool.tsx` — real `useDroppable`, responsive width, pending-slot UI
- `components/PoolCard.tsx` — larger grip, place-on-tap, wiggle when dragging
- `components/PlacedCard.tsx` — grip-button drag handle, responsive, wiggle
- `components/ManualCardModal.tsx` — slot-duration mode
- `components/GenerateButton.tsx` — category chips
- `app/api/trips/[id]/generate-cards/route.ts` — parse body, categories
- `lib/openai.ts` — category filter
- `lib/validations.ts` — zod schema for generate body
- `app/globals.css` — wiggle keyframes

## Version: v0.2.0
Tag after build verifies; rebuild local server for browser testing first.