import Link from "next/link";
import { requireUser } from "@/lib/session";
import { isSuperAdmin } from "@/lib/admin";
import { UserMenu } from "@/components/user-menu";
import { UploadsProvider } from "@/components/uploads-context";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const uploadsEnabled = !!process.env.BLOB_READ_WRITE_TOKEN;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/app" className="font-semibold tracking-tight">
              🎁 Registry for Groups
            </Link>
            <Link
              href="/app/requested"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Gifts requested
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
        <UploadsProvider enabled={uploadsEnabled}>{children}</UploadsProvider>
      </main>
      <footer className="mx-auto w-full max-w-5xl px-6 pb-10 pt-4">
        <div className="flex flex-col items-center gap-2 border-t pt-6 text-sm text-muted-foreground">
          <span>Made with 🎁 for families &amp; groups</span>
          <a
            href="https://buymeacoffee.com/tomchapman"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-muted"
          >
            ☕ Buy me a coffee
          </a>
        </div>
      </footer>
    </div>
  );
}
