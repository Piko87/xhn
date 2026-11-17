import Link from "next/link";

export default function NotFound() {
  return (
    <main className="content">
      <div className="card">
        <h1>没有找到这一页</h1>
        <Link className="btn" href="/">回工作台</Link>
      </div>
    </main>
  );
}
