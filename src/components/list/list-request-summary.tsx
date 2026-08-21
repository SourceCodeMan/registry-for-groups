import { formatPrice } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type RequestedItem = {
  priceCents: number | null;
  quantity: number;
};

/** Owner-facing totals for one wishlist. This is derived only from the list's
 * items, so it never consults claims or leaks whether a gift was reserved. */
export function ListRequestSummary({ items }: { items: RequestedItem[] }) {
  const giftCount = items.reduce((total, item) => total + item.quantity, 0);
  const pricedItems = items.filter((item) => item.priceCents != null);
  const totalCents = pricedItems.reduce(
    (total, item) => total + item.priceCents! * item.quantity,
    0,
  );
  const isComplete = pricedItems.length === items.length;

  return (
    <section className="grid gap-3 sm:grid-cols-2" aria-label="List summary">
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Gifts requested
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tracking-tight">
            {giftCount.toLocaleString()}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {items.length.toLocaleString()} {items.length === 1 ? "item" : "items"} on this list
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Estimated total
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tracking-tight">
            {formatPrice(totalCents) ?? "$0.00"}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {items.length === 0
              ? "Add prices to see your total"
              : isComplete
                ? "all items with quantities included"
                : `${(items.length - pricedItems.length).toLocaleString()} unpriced ${items.length - pricedItems.length === 1 ? "item isn't" : "items aren't"} included`}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
