import { redirect } from "next/navigation";
import type { ModuleKey } from "./constants";
import { can, getCurrentUser } from "./auth";
import type { SessionUser } from "./types";

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAccess(module: ModuleKey, level: "read" | "write") {
  const user = await requireUser();
  if (!can(user.access, module, level)) redirect("/forbidden");
  return user;
}
