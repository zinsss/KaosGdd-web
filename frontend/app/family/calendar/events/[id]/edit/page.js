import FamilyCalendarEventFormClient from "../../FamilyCalendarEventFormClient";

export const metadata = {
  title: "일정 수정 - KaosGdd",
};

export default async function FamilyEditCalendarEventPage({ params }) {
  const { id } = await params;
  return <FamilyCalendarEventFormClient eventId={id} />;
}
