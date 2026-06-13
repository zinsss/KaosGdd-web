import FamilyTaskFormClient from "../../FamilyTaskFormClient";

export const metadata = {
  title: "할 일 수정 - KaosGdd",
};

export default async function FamilyEditTaskPage({ params }) {
  const { id } = await params;
  return <FamilyTaskFormClient taskId={id} />;
}
