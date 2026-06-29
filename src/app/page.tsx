import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getSession } from "@/lib/session";

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
          <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }))}>
            Log in
          </Link>
          <Link href="/signup" className={cn(buttonVariants())}>
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-6 py-20 text-center">
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Gift registries for the people you love.
        </h1>
        <p className="text-balance max-w-xl text-lg text-muted-foreground">
          Everyone makes their wishlists. The group claims gifts so nothing gets
          bought twice — and the person never sees what&apos;s been picked. No
          spoiled surprises, no awkward group texts.
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
    </main>
  );
}
