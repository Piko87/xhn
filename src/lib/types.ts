import type { Access, ModuleKey } from "./constants";

export type ActionState = { ok: boolean; message: string } | null;

export type SessionUser = {
  id: number;
  name: string;
  account: string;
  role_id: number;
  role_name: string;
  status: string;
  access: Record<ModuleKey, Access>;
};

export type FeeTier = { beforeHours: number; feePercent: number };

export type TicketInput = {
  id: number;
  name: string;
  zone_id: number | null;
  book_start: string;
  book_end: string;
  calendar_mode: string;
  daily_stock: number;
  total_stock: number;
  cost_price: number;
  retail_price: number;
  window_price: number;
  gate_price: number;
  weekdays: number[];
  need_play_date: number;
  entry_mode: string;
  verify_before_minutes: number;
  auto_verify: number;
  auto_verify_hour: number;
  precheck: number;
  id_compare: number;
  show_order_code: number;
  order_hint: string;
  ticket_desc: string;
  advance_mode: string;
  advance_value: number;
  timed_sale: number;
  timed_start: string;
  timed_end: string;
  seating_mode: string;
  sale_channels: number[];
  order_min: number;
  order_max: number;
  realname: string;
  limit_by: string;
  limit_days: number;
  limit_qty: number;
  age_min: number | null;
  age_max: number | null;
  risk_tip: string;
  pay_mode: string;
  unpaid_cancel_minutes: number;
  notify_visitor_sms: number;
  notify_visitor_wechat: number;
  notify_supplier_sms: number;
  notify_distributor_sms: number;
  sms_header: string;
  sms_body: string;
  pickup_time: string;
  qr_type: string;
  print_mode: string;
  voice_mode: string;
  voice_custom: string;
  refund_mode: string;
  refund_days: number;
  refund_audit: number;
  pickup_refund: string;
  qty_change: string;
  fee_tiers: FeeTier[];
  reschedule: number;
  reschedule_channels: number[];
  reschedule_audit: number;
  reschedule_weekend: string;
  change_audit: number;
  expire_action: string;
  people_count: number;
  special_type: string;
  special_gender: string;
  special_region: string;
  shelf_mode: string;
  shelf_trigger: string;
  shelf_on: string;
  shelf_off: string;
};

export type HoldInput = { channelId: number; qty: number };

export type ZoneAllocationInput = {
  zoneId: number;
  reserved: number;
  holds: HoldInput[];
};
