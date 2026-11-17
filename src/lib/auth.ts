import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { MODULES, type Access, type ModuleKey } from "./constants";
import { getDb } from "./db";
import type { SessionUser } from "./types";

const COOKIE = "xhn_session";
const SECRET = process.env.SESSION_SECRET || "xhn-local-dev-only-not-for-production";

function sign(userId: number, exp: number) {
  const body = `${userId}.${exp}`;
  const signature = createHmac("sha256", SECRET).update(body).digest("hex");
  return `${body}.${signature}`;
}

export function readToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, signature] = parts;
  const expected = createHmac("sha256", SECRET).update(`${id}.${exp}`).digest("hex");
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return null;
  if (Number(exp) < Date.now()) return null;
  const userId = Number(id);
  return Number.isFinite(userId) ? userId : null;
}

export function accessForRole(roleId: number) {
  const rows = getDb()
    .prepare("SELECT module_key, access FROM role_permissions WHERE role_id = ?")
    .all(roleId) as { module_key: string; access: Access }[];
  const access = Object.fromEntries(MODULES.map((module) => [module.key, "none"])) as Record<ModuleKey, Access>;
  for (const row of rows) {
    if (row.module_key in access) access[row.module_key as ModuleKey] = row.access;
  }
  return access;
}

export function can(access: Record<ModuleKey, Access>, module: ModuleKey, level: "read" | "write") {
  const current = access[module];
  if (level === "read") return current === "read" || current === "write";
  return current === "write";
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const userId = readToken(raw);
  if (!userId) return null;
  const row = getDb()
    .prepare(
      `SELECT u.id, u.name, u.account, u.role_id, u.status, r.name AS role_name
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
    )
    .get(userId) as Omit<SessionUser, "access"> | undefined;
  if (!row || row.status !== "enabled") return null;
  return { ...row, access: accessForRole(row.role_id) };
}

export async function setSession(userId: number) {
  const jar = await cookies();
  jar.set(COOKIE, sign(userId, Date.now() + 7 * 86_400_000), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 86_400,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}
