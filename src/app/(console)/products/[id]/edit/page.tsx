import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/guard";
import { getProduct, listVenues } from "@/lib/queries";
import { ProductForm } from "../../product-form";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAccess("products", "write");
  const { id } = await params;
  const data = getProduct(Number(id));
  if (!data) notFound();
  const product = data.product as {
    id: number;
    name: string;
    area: string;
    terminal_no: string;
    address: string;
    venue_id: number | null;
    published_at: string;
    remark: string;
    hue: number;
    intro: string;
    director: string;
    traffic: string;
    notice: string;
    supplier_phone: string;
  };
  return (
    <div>
      <header className="page-head">
        <div>
          <p className="eyebrow">编辑产品</p>
          <h1>{product.name}</h1>
        </div>
        <Link className="btn" href={`/products/${product.id}`}>预览</Link>
      </header>
      <ProductForm product={product} venues={listVenues()} />
    </div>
  );
}
