import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { SeatEditor } from "@/components/seat-editor";
import type { Numbering } from "@/lib/constants";
import { can } from "@/lib/auth";
import { requireAccess } from "@/lib/guard";
import { getVenue, listLogs, qget } from "@/lib/queries";
import { saveZone } from "@/server/show-actions";

export default async function SeatsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAccess("seatmaps", "read");
  const editable = can(user.access, "seatmaps", "write");
  const { id } = await params;
  const venue = getVenue(Number(id));
  if (!venue) notFound();
  const grid = qget<{ grid_rows: number; grid_cols: number }>("SELECT grid_rows, grid_cols FROM venues WHERE id = ?", venue.id);
  const logs = listLogs("座位图", String(venue.id));
  return (
    <div>
      <header className="page-head">
        <div>
          <p className="eyebrow">{venue.name}</p>
          <h1>座位图模板</h1>
          <p className="sub">{venue.map_note || "同一张画布上排行、列、分区、过道和可售。"}</p>
        </div>
        <Link className="btn" href={`/venues/${venue.id}`}>返回场馆</Link>
      </header>
      {editable ? (
        <ActionForm action={saveZone} className="card actions">
          <input type="hidden" name="venue_id" value={venue.id} />
          <label className="field"><span>新分区名称</span><input name="name" placeholder="例如 乐池" /></label>
          <label className="field"><span>颜色</span><input name="color" defaultValue="#6b4c7a" /></label>
          <button className="btn" type="submit">新建分区</button>
          <p className="hint">建好后直接在图上划选，不用先重排。</p>
        </ActionForm>
      ) : null}
      <SeatEditor
        venueId={venue.id}
        editable={editable}
        initialRows={grid?.grid_rows || 12}
        initialCols={grid?.grid_cols || 16}
        zones={venue.zones.map((zone) => ({ id: zone.id, name: zone.name, color: zone.color, numbering: zone.numbering as Numbering }))}
        seats={venue.seats.map((seat) => ({ ...seat, kind: seat.kind || "seat" }))}
      />
      <section className="card">
        <h2>操作记录</h2>
        {logs.length === 0 ? <p className="hint">还没有保存记录。</p> : logs.map((item) => <p key={item.id}><b>{item.actor}</b> <span className="note">{item.created_at}</span> {item.summary}</p>)}
      </section>
    </div>
  );
}
