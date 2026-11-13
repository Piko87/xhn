export type HoldStock = {
  channelId: number;
  qty: number;
  sold: number;
  remaining: number;
};

export type ZoneStock = {
  zoneId: number;
  capacity: number;
  unsellable: number;
  reserved: number;
  holds: HoldStock[];
  sharedPool: number;
  sharedSold: number;
  sharedRemaining: number;
  available: number;
  sold: number;
  overAllocated: boolean;
};

export type OccupyingOrder = {
  zone_id: number;
  channel_id: number;
  qty: number;
  status: string;
};

const OCCUPYING = new Set(["未使用", "已使用", "部分使用", "待确认"]);

export function isOccupying(status: string) {
  return OCCUPYING.has(status);
}

export function stockForZone(input: {
  zoneId: number;
  capacity: number;
  unsellable: number;
  reserved: number;
  holds: { channelId: number; qty: number }[];
  orders: OccupyingOrder[];
}): ZoneStock {
  const holdChannel = new Set(input.holds.map((hold) => hold.channelId));
  const soldByChannel = new Map<number, number>();
  let sharedSold = 0;
  for (const order of input.orders) {
    if (order.zone_id !== input.zoneId || !isOccupying(order.status)) continue;
    if (holdChannel.has(order.channel_id)) {
      soldByChannel.set(order.channel_id, (soldByChannel.get(order.channel_id) ?? 0) + order.qty);
    } else {
      sharedSold += order.qty;
    }
  }
  const holds = input.holds.map((hold) => {
    const sold = soldByChannel.get(hold.channelId) ?? 0;
    return { channelId: hold.channelId, qty: hold.qty, sold, remaining: hold.qty - sold };
  });
  const exclusiveQty = holds.reduce((sum, hold) => sum + hold.qty, 0);
  const sharedPool = input.capacity - input.reserved - exclusiveQty;
  const exclusiveSold = holds.reduce((sum, hold) => sum + hold.sold, 0);
  return {
    zoneId: input.zoneId,
    capacity: input.capacity,
    unsellable: input.unsellable,
    reserved: input.reserved,
    holds,
    sharedPool,
    sharedSold,
    sharedRemaining: sharedPool - sharedSold,
    available: sharedPool - sharedSold + holds.reduce((sum, hold) => sum + hold.remaining, 0),
    sold: sharedSold + exclusiveSold,
    overAllocated: input.reserved + exclusiveQty > input.capacity || sharedPool < 0,
  };
}

export function remainingForChannel(stock: ZoneStock, channelId: number) {
  const hold = stock.holds.find((item) => item.channelId === channelId);
  if (hold) return hold.remaining;
  return stock.sharedRemaining;
}

export function fuzzyWord(available: number, denominator: number, ample: number, tight: number) {
  if (available <= 0) return "售罄";
  const ratio = (available / Math.max(denominator, 1)) * 100;
  if (ratio >= ample) return "充足";
  if (ratio >= tight) return "紧张";
  return "少量";
}

export function customerStockLabel(
  available: number,
  denominator: number,
  venue: { display_mode: string; fuzzy_ample: number; fuzzy_tight: number },
) {
  if (venue.display_mode === "realtime") return available <= 0 ? "售罄" : `${available}`;
  return fuzzyWord(available, denominator, venue.fuzzy_ample, venue.fuzzy_tight);
}
