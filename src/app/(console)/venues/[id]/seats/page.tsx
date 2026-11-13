import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { SeatEditor } from "@/components/seat-editor";
import { NUMBERINGS } from "@/lib/constants";
import { can } from "@/lib/auth";
import { requireAccess } from "@/lib/guard";
import { getVenue, plain } from "@/lib/queries";
import { regenerateZone } from "@/server/show-actions";

export default async function SeatsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAccess("seatmaps", "read");
  const editable = can(user.access, "seatmaps", "write");
  const { id } = await params;
  const venue = getVenue(Number(id));
  if (!venue) notFound();
  return (
    <div>
      <header className="page-head">
        <div>
          <p className="eyebrow">{venue.name}</p>
          <h1>座位图模板</h1>
          <p className="sub">{venue.map_note}</p>
        </div>
        <Link className="btn" href={`/venues/${venue.id}`}>返回场馆</Link>
      </header>
      <SeatEditor
        venueId={venue.id}
        editable={editable}
        zones={plain(venue.zones.map((zone) => ({ id: zone.id, name: zone.name, color: zone.color, numbering: zone.numbering })))}
        seats={plain(venue.seats)}
      />
      {editable ? (
        <section className="card" style={{ marginTop: 14 }}>
          <h2>按模板重排</h2>
          <p className="hint">重排会替换该分区现有座位号。已售订单仍保留当时的座位文字。</p>
          <div className="grid-2">
            {venue.zones.map((zone) => (
              <ActionForm key={zone.id} action={regenerateZone} className="stack">
                <strong>{zone.name}</strong>
                <input type="hidden" name="venue_id" value={venue.id} />
                <input type="hidden" name="zone_id" value={zone.id} />
                <div className="grid-2">
                  <label className="field"><span>排数</span><input name="rows" type="number" defaultValue={zone.rows_n || 4} /></label>
                  <label className="field"><span>列数</span><input name="cols" type="number" defaultValue={zone.cols_n || 8} /></label>
                  <label className="field"><span>编号</span>
                    <select name="numbering" defaultValue={zone.numbering}>
                      {NUMBERINGS.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="check"><input type="checkbox" name="default_sellable" defaultChecked /> 默认可售</label>
                </div>
                <button className="btn danger" type="submit">重排 {zone.name}</button>
              </ActionForm>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
