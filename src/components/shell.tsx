"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/lib/constants";
import type { SessionUser } from "@/lib/types";
import { logoutAction } from "@/server/auth-actions";

function active(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/products") return pathname.startsWith("/products") || pathname.startsWith("/tickets");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({
  user,
  now,
  children,
}: {
  user: SessionUser;
  now: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const groups = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => user.access[item.module] !== "none"),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <svg viewBox="0 0 32 32" className="mark" aria-hidden="true">
            <rect x="3" y="5" width="7" height="8" rx="1.5" />
            <rect x="12.5" y="5" width="7" height="8" rx="1.5" />
            <rect x="22" y="5" width="7" height="8" rx="1.5" />
            <rect x="7" y="17" width="7" height="8" rx="1.5" />
            <rect x="18" y="17" width="7" height="8" rx="1.5" />
          </svg>
          <span>
            <strong>席衡</strong>
            <em>剧场演出工作台</em>
          </span>
        </Link>
        <nav className="nav">
          {groups.map((group) => (
            <div key={group.group} className="nav-group">
              <p>{group.group}</p>
              {group.items.map((item) => (
                <Link key={item.href} href={item.href} className={active(pathname, item.href) ? "active" : ""}>
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <p className="aside-foot">一期只做剧场演出。数据留在本机。</p>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>业务时区 Asia/Shanghai · {now}</span>
          <div className="who">
            <b>{user.name}</b>
            <span className="role-pill">{user.role_name}</span>
            <form action={logoutAction}>
              <button className="btn ghost small" type="submit">
                退出
              </button>
            </form>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
