import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Pricing — Always free" };

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Always free.</h1>
      <p className="mt-3 text-[var(--color-fg-muted)]">
        JobScope runs on free tiers, so it stays free for you. No credit card, no upsell.
      </p>
      <Card className="mt-12 text-left">
        <CardHeader>
          <CardTitle className="text-2xl">Everything included</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              "Unlimited resumes",
              "Daily job ingestion from 7 sources",
              "AI cover letters & skill gaps",
              "Application Kanban tracker",
              "Daily digest emails",
              "Dark mode",
              "Your data, exportable any time",
              "Delete account anytime",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 text-[var(--color-success)]" />
                {f}
              </li>
            ))}
          </ul>
          <Button variant="accent" className="mt-8" asChild>
            <Link href="/signup">Create your free account</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
