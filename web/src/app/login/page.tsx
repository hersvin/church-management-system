import type { Metadata } from "next";
import Link from "next/link";
import { FadeIn } from "@/components/motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="bg-muted/40 flex flex-1 items-center justify-center p-4">
      <FadeIn y={12} className="flex w-full max-w-sm flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>Use your church staff account to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
        <Link href="/" className="text-muted-foreground text-center text-sm hover:underline">
          Back to website
        </Link>
      </FadeIn>
    </main>
  );
}
