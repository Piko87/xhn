import { ActionForm } from "@/components/action-form";
import { saveProduct } from "@/server/catalog-actions";

type Venue = { id: number; name: string };
type ProductFields = {
  id?: number;
  name?: string;
  area?: string;
  terminal_no?: string;
  address?: string;
  venue_id?: number | null;
  published_at?: string;
  remark?: string;
  hue?: number;
  intro?: string;
  director?: string;
  traffic?: string;
  notice?: string;
  supplier_phone?: string;
};

export function ProductForm({ product, venues }: { product?: ProductFields; venues: Venue[] }) {
  return (
    <ActionForm action={saveProduct} className="card stack">
      <input type="hidden" name="id" value={product?.id ?? ""} />
      <div className="grid-2">
        <label className="field"><span>演出名称</span><input name="name" defaultValue={product?.name ?? ""} required /></label>
        <label className="field"><span>区域</span><input name="area" defaultValue={product?.area ?? ""} required /></label>
        <label className="field"><span>终端号</span><input name="terminal_no" defaultValue={product?.terminal_no ?? ""} required /></label>
        <label className="field"><span>地址</span><input name="address" defaultValue={product?.address ?? ""} required /></label>
        <label className="field"><span>场馆</span>
          <select name="venue_id" defaultValue={product?.venue_id ?? ""}>
            <option value="">稍后再关联</option>
            {venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
          </select>
        </label>
        <label className="field"><span>发布时间</span><input name="published_at" defaultValue={product?.published_at ?? ""} /></label>
        <label className="field"><span>封面色相</span><input name="hue" type="number" defaultValue={product?.hue ?? 16} /></label>
        <label className="field"><span>供应商电话</span><input name="supplier_phone" defaultValue={product?.supplier_phone ?? ""} /></label>
      </div>
      <label className="field"><span>备注</span><input name="remark" defaultValue={product?.remark ?? ""} /></label>
      <label className="field"><span>著名导演</span><input name="director" defaultValue={product?.director ?? ""} /></label>
      <label className="field"><span>演出简介</span><textarea name="intro" defaultValue={product?.intro ?? ""} /></label>
      <label className="field"><span>预订须知</span><textarea name="notice" defaultValue={product?.notice ?? ""} /></label>
      <label className="field"><span>交通指南</span><textarea name="traffic" defaultValue={product?.traffic ?? ""} /></label>
      <button className="btn primary" type="submit">保存产品</button>
    </ActionForm>
  );
}
