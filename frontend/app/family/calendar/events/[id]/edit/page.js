import FamilyCalendarEventFormClient from "../../FamilyCalendarEventFormClient";

export const metadata = {
  title: "뭔날이고 - KaosGdd",
};

export default async function FamilyEditCalendarEventPage({ params }) {
  const { id } = await params;
  return <FamilyCalendarEventFormClient eventId={id} />;
}
