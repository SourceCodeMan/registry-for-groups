import Link from "next/link";
import { getInvitePreview } from "@/lib/invites";
import { getSession } from "@/lib/session";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AcceptInvite } from "./accept-invite";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const preview = await getInvitePreview(token);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <Card className="w-full max-w-sm">
        {!preview.valid ? (
          <>
            <CardHeader>
              <CardTitle>Invite not available</CardTitle>
              <CardDescription>
                This invite link is invalid, already used, or expired. Ask the
                group admin for a fresh one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href="/"
                className={cn(buttonVariants({ variant: "outline" }), "w-full")}
              >
                Go home
              </Link>
            </CardContent>
          </>
        ) : (
          <JoinValid token={token} groupName={preview.groupName} />
        )}
      </Card>
    </main>
  );
}

async function JoinValid({
  token,
  groupName,
}: {
  token: string;
  groupName: string;
}) {
  const session = await getSession();
  const redirectTo = encodeURIComponent(`/join/${token}`);

  return (
    <>
      <CardHeader>
        <CardTitle>You&apos;re invited 🎁</CardTitle>
        <CardDescription>
          Join <span className="font-medium text-foreground">{groupName}</span>{" "}
          on Registry for Groups.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {session?.user ? (
          <AcceptInvite token={token} />
        ) : (
          <>
            <Link
              href={`/signup?redirect=${redirectTo}`}
              className={cn(buttonVariants(), "w-full")}
            >
              Create an account to join
            </Link>
            <Link
              href={`/login?redirect=${redirectTo}`}
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            >
              Log in to join
            </Link>
          </>
        )}
      </CardContent>
    </>
  );
}
