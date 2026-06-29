import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getOwnedListWithItems } from "@/lib/lists";
import { Badge } from "@/components/ui/badge";
import { ItemCard } from "./item-card";
import { ItemDialog } from "./item-dialog";
import { ListSettings } from "./list-settings";

const OCCASION_LABEL: Record<string, string> = {
  birthday: "Birthday",
  christmas: "Christmas",
  general: "General",
  other: "Other",
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ groupId: string; listId: string }>;
}) {
  const { groupId, listId } = await params;
  const user = await requireUser();

  const data = await getOwnedListWithItems(user.id, listId);
  // Owner-only view; uniform 404 otherwise (and verify it's in this group).
  if (!data || data.list.organizationId !== groupId) notFound();

  const { list, items } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={`/app/groups/${groupId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to group
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {list.title}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">
                {OCCASION_LABEL[list.occasion] ?? "General"}
              </Badge>
              {list.eventDate && <span>{formatDate(list.eventDate)}</span>}
            </div>
          </div>
          <ListSettings
            list={{
              id: list.id,
              title: list.title,
              occasion: list.occasion,
              eventDate: list.eventDate,
            }}
          />
        </div>
      </div>

      <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
        🤫 This is your list — you won&apos;t see who&apos;s claimed what, so
        nothing gets spoiled.
      </p>

      <div className="flex flex-col gap-3">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            No items yet. Add the first thing you&apos;d love to receive.
          </div>
        ) : (
          items.map((it, i) => (
            <ItemCard
              key={it.id}
              listId={listId}
              item={{
                id: it.id,
                title: it.title,
                description: it.description,
                url: it.url,
                imageUrl: it.imageUrl,
                priceCents: it.priceCents,
                quantity: it.quantity,
              }}
              isFirst={i === 0}
              isLast={i === items.length - 1}
            />
          ))
        )}
      </div>

      <div>
        <ItemDialog listId={listId} triggerLabel="+ Add item" />
      </div>
    </div>
  );
}
