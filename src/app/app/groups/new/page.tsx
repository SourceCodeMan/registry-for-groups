import Link from "next/link";
import { NewGroupForm } from "./new-group-form";

export default function NewGroupPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <Link
        href="/app"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back
      </Link>
      <NewGroupForm />
    </div>
  );
}
