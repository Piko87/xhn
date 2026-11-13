import { ActionForm } from "@/components/action-form";
import { statusTone } from "@/lib/format";
import { requireAccess } from "@/lib/guard";
import { can } from "@/lib/auth";
import { listRoles, listUsers } from "@/lib/queries";
import { saveUser } from "@/server/iam-actions";

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const user = await requireAccess("accounts", "read");
  const editable = can(user.access, "accounts", "write");
  const sp = await searchParams;
  const users = listUsers();
  const roles = listRoles();
  const editing = users.find((item) => String(item.id) === sp.edit);
  return (
    <div>
      <header className="page-head">
        <div>
          <p className="eyebrow">系统</p>
          <h1>账号管理</h1>
          <p className="sub">停用后无法登录。不能停用自己正在使用的账号。</p>
        </div>
      </header>
      <div className="split">
        <div className="table-wrap">
          <table>
            <thead><tr><th>姓名</th><th>账号</th><th>角色</th><th>状态</th><th></th></tr></thead>
            <tbody>
              {users.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.account}</td>
                  <td>{item.role_name}</td>
                  <td><span className={`badge ${statusTone(item.status === "enabled" ? "启用" : "停用")}`}>{item.status === "enabled" ? "启用" : "停用"}</span></td>
                  <td>{editable ? <a className="btn small" href={`/accounts?edit=${item.id}`}>编辑</a> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editable ? (
          <ActionForm action={saveUser} className="card stack">
            <h2>{editing ? `编辑 ${editing.name}` : "新建账号"}</h2>
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            <label className="field"><span>姓名</span><input name="name" defaultValue={editing?.name ?? ""} required /></label>
            <label className="field"><span>账号</span><input name="account" defaultValue={editing?.account ?? ""} required /></label>
            <label className="field"><span>角色</span>
              <select name="role_id" defaultValue={editing?.role_id ?? roles[0]?.id}>
                {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
              </select>
            </label>
            <label className="field"><span>状态</span>
              <select name="status" defaultValue={editing?.status ?? "enabled"}>
                <option value="enabled">启用</option>
                <option value="disabled">停用</option>
              </select>
            </label>
            <label className="field"><span>{editing ? "重置密码（留空则不变）" : "密码"}</span><input name="password" type="text" /></label>
            <button className="btn primary" type="submit">保存账号</button>
          </ActionForm>
        ) : null}
      </div>
    </div>
  );
}
