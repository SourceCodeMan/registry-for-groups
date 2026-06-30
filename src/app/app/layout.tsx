import Link from "next/link";
import { requireUser } from "@/lib/session";
import { isSuperAdmin } from "@/lib/admin";
import { UserMenu } from "@/components/user-menu";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/app" className="font-semibold tracking-tight">
              🎁 Registry for Groups
            </Link>
            <Link
              href="/app/giving"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Gifts I&apos;m giving
            </Link>
          </div>
          <UserMenu
            name={user.name}
            email={user.email}
            isSuperAdmin={isSuperAdmin(user)}
          />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
