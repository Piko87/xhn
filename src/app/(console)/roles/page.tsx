import { MODULES } from "@/lib/constants";
import { can } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { requireAccess } from "@/lib/guard";
import { listRoles } from "@/lib/queries";
import { deleteRole, saveRole } from "@/server/iam-actions";

export default async function RolesPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const user = await requireAccess("roles", "read");
  const editable = can(user.access, "roles", "write");
  const sp = await searchParams;
  const roles = listRoles();
  const selected = roles.find((role) => String(role.id) === sp.role) ?? roles[0];
  return (
    <div>
      <header className="page-head">
        <div>
          <p className="eyebrow">系统</p>
          <h1>角色与权限</h1>
          <p className="sub">模块权限按页面授予。只读角色可以查看，不能保存。默认角色可以改权限，不能删除。</p>
        </div>
      </header>
      <div className="split">
        <div className="card">
          {roles.map((role) => (
            <a key={role.id} href={`/roles?role=${role.id}`} className="btn" style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, background: selected?.id === role.id ? "#fff1ea" : undefined }}>
              <span>{role.name}{role.system ? " · 默认" : ""}</span>
              <span className="note">{role.users} 个账号</span>
            </a>
          ))}
          {editable ? <a className="btn" href="/roles?role=new">新建角色</a> : null}
        </div>
        {selected && sp.role !== "new" ? (
          <ActionForm action={saveRole} className="card">
            <h2>{selected.name}</h2>
            <input type="hidden" name="id" value={selected.id} />
            <div className="grid-2">
              <label className="field"><span>名称</span><input name="name" defaultValue={selected.name} disabled={!editable} /></label>
              <label className="field"><span>说明</span><input name="description" defaultValue={selected.description} disabled={!editable} /></label>
            </div>
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table>
                <thead><tr><th>模块</th><th>分组</th><th>无</th><th>只读</th><th>可写</th></tr></thead>
                <tbody>
                  {MODULES.map((module) => (
                    <tr key={module.key}>
                      <td>{module.label}</td>
                      <td>{module.group}</td>
                      {(["none", "read", "write"] as const).map((level) => (
                        <td key={level}>
                          <input type="radio" name={`perm_${module.key}`} value={level} defaultChecked={selected.access[module.key] === level} disabled={!editable} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {editable ? <button className="btn primary" type="submit" style={{ marginTop: 12 }}>保存权限</button> : null}
          </ActionForm>
        ) : null}
        {sp.role === "new" && editable ? (
          <ActionForm action={saveRole} className="card stack">
            <h2>新建角色</h2>
            <label className="field"><span>名称</span><input name="name" required /></label>
            <label className="field"><span>说明</span><input name="description" /></label>
            <p className="hint">新建后默认没有模块权限，保存前可以在下面勾选。</p>
            {MODULES.map((module) => (
              <label key={module.key} className="field"><span>{module.group} · {module.label}</span>
                <select name={`perm_${module.key}`} defaultValue="none">
                  <option value="none">无</option>
                  <option value="read">只读</option>
                  <option value="write">可写</option>
                </select>
              </label>
            ))}
            <button className="btn primary" type="submit">创建角色</button>
          </ActionForm>
        ) : null}
      </div>
      {selected && editable && !selected.system ? (
        <ActionForm action={deleteRole} className="card">
          <input type="hidden" name="id" value={selected.id} />
          <button className="btn danger" type="submit">删除这个角色</button>
        </ActionForm>
      ) : null}
    </div>
  );
}
