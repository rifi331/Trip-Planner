import { TripDetailClient } from "@/components/TripDetailClient";

// Server component wrapper. The interactive work lives in the client component
// because @dnd-kit needs browser APIs (pointer events, DOM measurement).
export default async function TripDetailPage({ params }: { params: { id: string } }) {
  return <TripDetailClient tripId={params.id} />;
}
