import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/session";
import { updateProfile } from "../actions";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const s = await requireSession();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={updateProfile} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={s.user.email} disabled />
          </div>
          <div className="space-y-1">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" name="name" defaultValue={s.user.name ?? ""} />
          </div>
          <Button variant="accent" type="submit">
            Save
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
