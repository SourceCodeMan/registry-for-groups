import Link from "next/link";
import { redirect } from "next/navigation";
import { Gift, Users, EyeOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getSession } from "@/lib/session";

const STEPS = [
  {
    icon: Gift,
    title: "Make your lists",
    body: "Everyone adds what they’d love — birthday, Christmas, or just a general wishlist. Paste a link and we fill in the details.",
  },
  {
    icon: Users,
    title: "Invite your people",
    body: "Send a single link to add the whole family or friend group. No app to install, no spreadsheet to wrangle.",
  },
  {
    icon: EyeOff,
    title: "Claim — secretly",
    body: "Reserve or mark a gift bought so nothing gets doubled up. The recipient never sees what’s been picked, or by whom.",
  },
];

export default async function Home() {
  const session = await getSession();
  if (session?.user) redirect("/app");

  return (
    <main className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold tracking-tight">
          🎁 Registry for Groups
        </span>
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "ghost" }))}
          >
            Log in
          </Link>
          <Link href="/signup" className={cn(buttonVariants())}>
            Get started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 pt-16 pb-20 text-center sm:pt-24">
        <span className="rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
          Free for your group
        </span>
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Gift registries for humans.
        </h1>
        <p className="max-w-xl text-balance text-lg text-muted-foreground">
          Everyone makes their wishlists. The group claims gifts so nothing gets
          bought twice — and the person never sees what’s been picked. No spoiled
          surprises, no awkward group texts.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup"
            className={cn(buttonVariants({ size: "lg" }))}
          >
            Create your group
          </Link>
          <Link
            href="/login"
            className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
          >
            I have an account
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t bg-muted/20">
        <div className="mx-auto grid w-full max-w-5xl gap-8 px-6 py-16 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex flex-col gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-foreground text-background">
                <s.icon className="size-5" />
              </div>
              <h3 className="font-semibold">
                {i + 1}. {s.title}
              </h3>
              <p className="text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The difference */}
      <section className="mx-auto w-full max-w-3xl px-6 py-20 text-center">
        <h2 className="text-balance text-3xl font-bold tracking-tight">
          The surprise stays a surprise.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-balance text-muted-foreground">
          On your own lists you’ll never see a single claim — not what’s been
          reserved, not what’s been bought. Everyone else sees what’s spoken for
          so gifts don’t collide, but no one ever learns who bought what. It’s
          the only part we got obsessive about.
        </p>
        <div className="mt-8">
          <Link
            href="/signup"
            className={cn(buttonVariants({ size: "lg" }))}
          >
            Start your registry
          </Link>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-2 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <span>🎁 Registry for Groups</span>
          <span>registryforgroups.com</span>
        </div>
      </footer>
    </main>
  );
}
