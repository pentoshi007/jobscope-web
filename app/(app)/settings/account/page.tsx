import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteAccountButton } from "./delete-button";

export const metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <Card className="border-[var(--color-danger)]/40">
      <CardHeader>
        <CardTitle className="text-[var(--color-danger)]">Delete account</CardTitle>
        <CardDescription>
          Permanently deletes your resumes, applications, matches, and session. This cannot be
          undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DeleteAccountButton />
      </CardContent>
    </Card>
  );
}
