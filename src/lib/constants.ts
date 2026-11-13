export const APP_NAME = "席衡";
export const APP_TAG = "剧场演出工作台";

export const MODULES = [
  { key: "overview", label: "概览", group: "工作台" },
  { key: "accounts", label: "账号管理", group: "系统" },
  { key: "roles", label: "角色与权限", group: "系统" },
  { key: "products", label: "出售中产品", group: "产品" },
  { key: "ticket_rules", label: "票类规则", group: "产品" },
  { key: "price_calendar", label: "价格日历", group: "产品" },
  { key: "channel_sales", label: "渠道销售配置", group: "产品" },
  { key: "venues", label: "场馆与分区", group: "演出" },
  { key: "seatmaps", label: "座位图", group: "演出" },
  { key: "sessions", label: "场次日历", group: "演出" },
  { key: "inventory", label: "分销库存", group: "演出" },
  { key: "sale_windows", label: "开售窗口", group: "演出" },
  { key: "orders", label: "订单明细", group: "订单" },
  { key: "verification", label: "票券验证", group: "订单" },
  { key: "notes", label: "订单备注", group: "订单" },
  { key: "refunds", label: "退票审核", group: "订单" },
  { key: "reports", label: "销售报表", group: "报表" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];
export type Access = "none" | "read" | "write";

export const NAV: { group: string; items: { href: string; label: string; module: ModuleKey }[] }[] = [
  { group: "工作台", items: [{ href: "/", label: "概览", module: "overview" }] },
  { group: "产品", items: [{ href: "/products", label: "出售中产品", module: "products" }] },
  {
    group: "演出管理",
    items: [
      { href: "/venues", label: "场馆管理", module: "venues" },
      { href: "/sessions", label: "场次日历", module: "sessions" },
      { href: "/inventory", label: "分销库存", module: "inventory" },
      { href: "/orders", label: "订单明细", module: "orders" },
    ],
  },
  { group: "订单", items: [{ href: "/refunds", label: "退票审核", module: "refunds" }] },
  { group: "报表", items: [{ href: "/reports", label: "销售报表", module: "reports" }] },
  {
    group: "系统",
    items: [
      { href: "/accounts", label: "账号管理", module: "accounts" },
      { href: "/roles", label: "角色与权限", module: "roles" },
    ],
  },
];

export const TICKET_TABS = ["类型", "验证", "下单", "支付", "通知", "取票", "退改", "其他"] as const;

export const NUMBERINGS = ["正序", "倒序", "奇数在左", "奇数在右"] as const;
export type Numbering = (typeof NUMBERINGS)[number];

export const DEMO_ACCOUNTS = [
  { role: "管理员", account: "guanli", password: "XiHeng-2401", name: "沈清和" },
  { role: "运营", account: "yunying", password: "XiHeng-2402", name: "周宁" },
  { role: "客服", account: "kefu", password: "XiHeng-2403", name: "何清" },
];
