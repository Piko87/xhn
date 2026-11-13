import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { DEMO_ACCOUNTS } from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth";
import { loginAction } from "@/server/auth-actions";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="login">
      <section className="login-hero">
        <p className="eyebrow" style={{ color: "#f0a07a" }}>剧场演出 · 一期</p>
        <h1>席衡</h1>
        <p>给客服和运营用的剧场票务工作台。管票类规则、分区座位、分渠道库存和退票审核。</p>
        <p>不连接外部票务系统，账号和订单都是演示数据。</p>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <h2>登录</h2>
          <ActionForm action={loginAction} className="stack">
            <label className="field">
              <span>账号</span>
              <input name="account" autoComplete="username" required />
            </label>
            <label className="field">
              <span>密码</span>
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            <button className="btn primary" type="submit">进入工作台</button>
          </ActionForm>
          <table className="mini-accounts">
            <thead>
              <tr><th>角色</th><th>账号</th><th>密码</th></tr>
            </thead>
            <tbody>
              {DEMO_ACCOUNTS.map((item) => (
                <tr key={item.account}>
                  <td>{item.role}</td>
                  <td>{item.account}</td>
                  <td>{item.password}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
