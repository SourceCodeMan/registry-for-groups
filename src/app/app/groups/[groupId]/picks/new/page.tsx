import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, getMembership } from "@/lib/session";
import { NewPickListForm } from "./new-pick-list-form";

export default async function NewPickListPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const user = await requireUser();
  const membership = await getMembership(user.id, groupId);
  if (!membership) notFound();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <Link
        href={`/app/groups/${groupId}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to group
      </Link>
      <NewPickListForm groupId={groupId} />
    </div>
  );
}
