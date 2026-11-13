import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="card">
      <h1>没有这个模块的权限</h1>
      <p>当前角色的菜单里没有该功能。需要访问时，请管理员在「角色与权限」里授予。</p>
      <Link className="btn" href="/">返回概览</Link>
    </div>
  );
}
