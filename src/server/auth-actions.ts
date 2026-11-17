"use server";

import { redirect } from "next/navigation";
import { clearSession, getCurrentUser, setSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import type { ActionState } from "@/lib/types";

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const account = String(formData.get("account") || "").trim();
  const password = String(formData.get("password") || "");
  const row = getDb()
    .prepare("SELECT id, password_hash, status FROM users WHERE account = ?")
    .get(account) as { id: number; password_hash: string; status: string } | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) {
    return { ok: false, message: "账号或密码不正确" };
  }
  if (row.status !== "enabled") return { ok: false, message: "账号已停用，请联系管理员" };
  await setSession(row.id);
  redirect("/");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export async function currentAccount() {
  const user = await getCurrentUser();
  return user?.account ?? "";
}
