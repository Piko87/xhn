import { requireAccess } from "@/lib/guard";
import { listVenues } from "@/lib/queries";
import { ProductForm } from "../product-form";

export default async function NewProductPage() {
  await requireAccess("products", "write");
  const venues = listVenues();
  return (
    <div>
      <header className="page-head"><div><p className="eyebrow">产品</p><h1>新建演出</h1></div></header>
      <ProductForm venues={venues} />
    </div>
  );
}
