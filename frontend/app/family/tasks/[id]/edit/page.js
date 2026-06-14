import FamilyTaskFormClient from "../../FamilyTaskFormClient";

export const metadata = {
  title: "고치까 - KaosGdd",
};

export default async function FamilyEditTaskPage({ params }) {
  const { id } = await params;
  return <FamilyTaskFormClient taskId={id} />;
}
