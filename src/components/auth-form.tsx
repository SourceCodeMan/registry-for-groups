"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Only allow internal redirect targets (open-redirect guard). */
function safePath(p: string | null): string {
  return p && p.startsWith("/") && !p.startsWith("//") ? p : "/app";
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = safePath(params.get("redirect"));
  const inviteQ = params.get("redirect")
    ? `?redirect=${encodeURIComponent(params.get("redirect")!)}`
    : "";

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const isSignup = mode === "signup";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignup) {
        const { error } = await authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
        });
        if (error) {
          toast.error(error.message ?? "Could not create your account.");
          return;
        }
      } else {
        const { error } = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (error) {
          toast.error(error.message ?? "Invalid email or password.");
          return;
        }
      }
      router.push(redirectTo);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{isSignup ? "Create your account" : "Welcome back"}</CardTitle>
        <CardDescription>
          {isSignup
            ? "Start a registry or join your group."
            : "Log in to your registries."}
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="flex flex-col gap-4">
          {isSignup && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={isSignup ? 12 : undefined}
              autoComplete={isSignup ? "new-password" : "current-password"}
            />
            {isSignup && (
              <p className="text-xs text-muted-foreground">
                At least 12 characters.
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="mt-6 flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? "Please wait…"
              : isSignup
                ? "Create account"
                : "Log in"}
          </Button>
          <p className="text-sm text-muted-foreground">
            {isSignup ? (
              <>
                Already have an account?{" "}
                <Link
                  href={`/login${inviteQ}`}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Log in
                </Link>
              </>
            ) : (
              <>
                New here?{" "}
                <Link
                  href={`/signup${inviteQ}`}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Create an account
                </Link>
              </>
            )}
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
