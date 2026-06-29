import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getOwnedListWithItems } from "@/lib/lists";
import { formatDate, OCCASION_LABEL } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { ItemCard } from "@/components/list/item-card";
import { ItemDialog } from "@/components/list/item-dialog";
import { ListSettings } from "@/components/list/list-settings";

export default async function PersonalListPage({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
  const { listId } = await params;
  const user = await requireUser();

  const data = await getOwnedListWithItems(user.id, listId);
  if (!data) notFound();
  // Grouped lists live under their group route.
  if (data.list.organizationId !== null) {
    redirect(`/app/groups/${data.list.organizationId}/lists/${listId}`);
  }

  const { list, items } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/app"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to home
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
        📦 This is a personal list — it isn&apos;t shared with any group yet.
      </p>

      <div className="flex flex-col gap-3">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            No items yet.
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
