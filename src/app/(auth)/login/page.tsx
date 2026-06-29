import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </main>
  );
}
