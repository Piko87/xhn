"use server";

import { revalidatePath } from "next/cache";
import { MODULES, type Access, type ModuleKey } from "@/lib/constants";
import { getDb } from "@/lib/db";
import { requireAccess } from "@/lib/guard";
import { hashPassword } from "@/lib/password";
import type { ActionState } from "@/lib/types";

function cleanAccount(value: string) {
  return value.trim().toLowerCase();
}

export async function saveUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireAccess("accounts", "write");
  const id = Number(formData.get("id") || 0);
  const name = String(formData.get("name") || "").trim();
  const account = cleanAccount(String(formData.get("account") || ""));
  const roleId = Number(formData.get("role_id") || 0);
  const status = String(formData.get("status") || "enabled") === "disabled" ? "disabled" : "enabled";
  const password = String(formData.get("password") || "");
  if (!name || !account || !roleId) return { ok: false, message: "请填写姓名、账号和角色" };
  if (!/^[a-z][a-z0-9_]{2,20}$/.test(account)) return { ok: false, message: "账号需为 3–21 位小写字母、数字或下划线，并以字母开头" };
  const db = getDb();
  const role = db.prepare("SELECT id FROM roles WHERE id = ?").get(roleId);
  if (!role) return { ok: false, message: "角色不存在" };
  const duplicate = db.prepare("SELECT id FROM users WHERE account = ? AND id != ?").get(account, id) as { id: number } | undefined;
  if (duplicate) return { ok: false, message: "账号已被使用" };
  if (id && id === actor.id && status === "disabled") return { ok: false, message: "不能停用当前登录账号" };
  if (!id && password.length < 6) return { ok: false, message: "新账号密码至少 6 位" };
  if (password && password.length < 6) return { ok: false, message: "密码至少 6 位" };
  if (id) {
    if (password) {
      db.prepare("UPDATE users SET name = ?, account = ?, role_id = ?, status = ?, password_hash = ? WHERE id = ?").run(
        name,
        account,
        roleId,
        status,
        hashPassword(password),
        id,
      );
    } else {
      db.prepare("UPDATE users SET name = ?, account = ?, role_id = ?, status = ? WHERE id = ?").run(name, account, roleId, status, id);
    }
  } else {
    db.prepare(
      "INSERT INTO users (name, account, password_hash, role_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(name, account, hashPassword(password), roleId, status, new Date().toISOString().slice(0, 16).replace("T", " "));
  }
  revalidatePath("/accounts");
  return { ok: true, message: id ? "账号已保存" : "账号已创建" };
}

export async function saveRole(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAccess("roles", "write");
  const id = Number(formData.get("id") || 0);
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  if (!name) return { ok: false, message: "请填写角色名称" };
  const db = getDb();
  const duplicate = db.prepare("SELECT id FROM roles WHERE name = ? AND id != ?").get(name, id) as { id: number } | undefined;
  if (duplicate) return { ok: false, message: "角色名称已存在" };
  let roleId = id;
  if (id) {
    db.prepare("UPDATE roles SET name = ?, description = ? WHERE id = ?").run(name, description, id);
  } else {
    const info = db.prepare("INSERT INTO roles (name, description, system) VALUES (?, ?, 0)").run(name, description);
    roleId = Number(info.lastInsertRowid);
  }
  const access = new Map<ModuleKey, Access>();
  for (const module of MODULES) {
    const value = String(formData.get(`perm_${module.key}`) || "none");
    access.set(module.key, value === "read" || value === "write" ? value : "none");
  }
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM role_permissions WHERE role_id = ?").run(roleId);
    const insert = db.prepare("INSERT INTO role_permissions (role_id, module_key, access) VALUES (?, ?, ?)");
    for (const [key, level] of access) insert.run(roleId, key, level);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  revalidatePath("/roles");
  revalidatePath("/");
  return { ok: true, message: "角色权限已保存。重新进入页面后菜单会按新权限显示。" };
}

export async function deleteRole(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAccess("roles", "write");
  const id = Number(formData.get("id") || 0);
  const db = getDb();
  const role = db.prepare("SELECT system FROM roles WHERE id = ?").get(id) as { system: number } | undefined;
  if (!role) return { ok: false, message: "角色不存在" };
  if (role.system) return { ok: false, message: "默认角色不能删除，可以调整它的权限" };
  const used = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role_id = ?").get(id) as { n: number };
  if (used.n > 0) return { ok: false, message: "仍有账号使用该角色" };
  db.prepare("DELETE FROM role_permissions WHERE role_id = ?").run(id);
  db.prepare("DELETE FROM roles WHERE id = ?").run(id);
  revalidatePath("/roles");
  return { ok: true, message: "角色已删除" };
}
