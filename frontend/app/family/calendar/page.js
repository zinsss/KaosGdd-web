import { redirect } from "next/navigation";

export const metadata = {
  title: "달력 - KaosGdd",
};

export default function FamilyCalendarPage() {
  redirect("/family/calendar2");
}
