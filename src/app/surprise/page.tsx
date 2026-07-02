import type { Metadata } from "next";
import Link from "next/link";
import { ShakeBox } from "./shake-box";

export const metadata: Metadata = {
  title: "A little surprise",
  robots: { index: false, follow: false },
};

export default function SurprisePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-sm flex-col items-center gap-10">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          🎁 Registry for Groups
        </Link>
        <ShakeBox />
      </div>
    </main>
  );
}
