import Link from "next/link";
import { requireUser } from "@/lib/session";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DeleteAccount } from "@/components/delete-account";

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/app"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to app
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 text-sm">
          <div>
            <span className="text-muted-foreground">Name:</span> {user.name}
          </div>
          <div className="[overflow-wrap:anywhere]">
            <span className="text-muted-foreground">Email:</span> {user.email}
          </div>
        </CardContent>
      </Card>

      <DeleteAccount />
    </div>
  );
}
