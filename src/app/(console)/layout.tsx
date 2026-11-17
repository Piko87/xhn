import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/guard";
import { shanghaiNow } from "@/lib/time";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const now = shanghaiNow();
  return (
    <Shell user={user} now={`${now.date} ${now.time}`}>
      {children}
    </Shell>
  );
}
