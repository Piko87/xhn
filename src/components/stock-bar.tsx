export function StockBar({
  capacity,
  exclusive,
  shared,
  reserved,
  unsellable,
}: {
  capacity: number;
  exclusive: number;
  shared: number;
  reserved: number;
  unsellable: number;
}) {
  const total = Math.max(capacity + unsellable, 1);
  const parts = [
    { label: "独立", value: Math.max(exclusive, 0), color: "#c4552a" },
    { label: "共享", value: Math.max(shared, 0), color: "#1f6f64" },
    { label: "预留", value: Math.max(reserved, 0), color: "#b0893e" },
    { label: "不可售", value: Math.max(unsellable, 0), color: "#c8bbaa" },
  ];
  return (
    <div>
      <div className="bar-stack" aria-hidden="true">
        {parts.map((part) => (
          <i key={part.label} style={{ width: `${(part.value / total) * 100}%`, background: part.color }} />
        ))}
      </div>
      <div className="legend" style={{ marginTop: 8 }}>
        {parts.map((part) => (
          <span key={part.label}><i className="swatch" style={{ background: part.color }} /> {part.label} {part.value}</span>
        ))}
        <span>可售座位 {capacity}</span>
      </div>
    </div>
  );
}
