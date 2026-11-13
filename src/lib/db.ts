import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";
import { MODULES, type Access, type Numbering } from "./constants";
import { hashPassword } from "./password";
import { seatLabel, seatSequence } from "./seats";
import { addDays, weekdayOf } from "./time";

const SCHEMA_VERSION = "1";

const globalForDb = globalThis as unknown as { xhnDb?: DatabaseSync };

function databasePath() {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "xhn.sqlite");
}

export function getDb() {
  if (!globalForDb.xhnDb) {
    const db = new DatabaseSync(databasePath());
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
    migrate(db);
    globalForDb.xhnDb = db;
  }
  return globalForDb.xhnDb;
}

function migrate(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      system INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL,
      module_key TEXT NOT NULL,
      access TEXT NOT NULL,
      PRIMARY KEY (role_id, module_key)
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      account TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'enabled',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS distributors (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      group_name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS channels (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      distributor_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS venues (
      id INTEGER PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      map_note TEXT NOT NULL DEFAULT '',
      display_mode TEXT NOT NULL DEFAULT 'fuzzy',
      fuzzy_ample INTEGER NOT NULL DEFAULT 40,
      fuzzy_tight INTEGER NOT NULL DEFAULT 15
    );
    CREATE TABLE IF NOT EXISTS zones (
      id INTEGER PRIMARY KEY,
      venue_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      rows_n INTEGER NOT NULL,
      cols_n INTEGER NOT NULL,
      numbering TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS seats (
      id INTEGER PRIMARY KEY,
      venue_id INTEGER NOT NULL,
      zone_id INTEGER NOT NULL,
      row_no INTEGER NOT NULL,
      col_no INTEGER NOT NULL,
      row_label TEXT NOT NULL,
      seat_no INTEGER NOT NULL,
      sellable INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      product_type TEXT NOT NULL DEFAULT '演出',
      area TEXT NOT NULL,
      terminal_no TEXT NOT NULL,
      address TEXT NOT NULL,
      published_at TEXT NOT NULL,
      remark TEXT NOT NULL DEFAULT '',
      hue INTEGER NOT NULL DEFAULT 16,
      intro TEXT NOT NULL DEFAULT '',
      director TEXT NOT NULL DEFAULT '',
      traffic TEXT NOT NULL DEFAULT '',
      notice TEXT NOT NULL DEFAULT '',
      supplier_phone TEXT NOT NULL DEFAULT '',
      venue_id INTEGER,
      status TEXT NOT NULL DEFAULT '出售中'
    );
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      product_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      zone_id INTEGER,
      book_start TEXT NOT NULL,
      book_end TEXT NOT NULL,
      calendar_mode TEXT NOT NULL,
      daily_stock INTEGER NOT NULL,
      total_stock INTEGER NOT NULL,
      cost_price INTEGER NOT NULL,
      retail_price INTEGER NOT NULL,
      window_price INTEGER NOT NULL,
      gate_price INTEGER NOT NULL,
      weekdays TEXT NOT NULL,
      need_play_date INTEGER NOT NULL,
      entry_mode TEXT NOT NULL,
      verify_before_minutes INTEGER NOT NULL,
      auto_verify INTEGER NOT NULL,
      auto_verify_hour INTEGER NOT NULL,
      precheck INTEGER NOT NULL,
      id_compare INTEGER NOT NULL,
      show_order_code INTEGER NOT NULL,
      order_hint TEXT NOT NULL,
      ticket_desc TEXT NOT NULL,
      advance_mode TEXT NOT NULL,
      advance_value INTEGER NOT NULL,
      timed_sale INTEGER NOT NULL,
      timed_start TEXT NOT NULL,
      timed_end TEXT NOT NULL,
      seating_mode TEXT NOT NULL,
      sale_channels TEXT NOT NULL,
      order_min INTEGER NOT NULL,
      order_max INTEGER NOT NULL,
      realname TEXT NOT NULL,
      limit_by TEXT NOT NULL,
      limit_days INTEGER NOT NULL,
      limit_qty INTEGER NOT NULL,
      age_min INTEGER,
      age_max INTEGER,
      risk_tip TEXT NOT NULL,
      pay_mode TEXT NOT NULL,
      unpaid_cancel_minutes INTEGER NOT NULL,
      notify_visitor_sms INTEGER NOT NULL,
      notify_visitor_wechat INTEGER NOT NULL,
      notify_supplier_sms INTEGER NOT NULL,
      notify_distributor_sms INTEGER NOT NULL,
      sms_header TEXT NOT NULL,
      sms_body TEXT NOT NULL,
      pickup_time TEXT NOT NULL,
      qr_type TEXT NOT NULL,
      print_mode TEXT NOT NULL,
      voice_mode TEXT NOT NULL,
      voice_custom TEXT NOT NULL,
      refund_mode TEXT NOT NULL,
      refund_days INTEGER NOT NULL,
      refund_audit INTEGER NOT NULL,
      pickup_refund TEXT NOT NULL,
      qty_change TEXT NOT NULL,
      fee_tiers TEXT NOT NULL,
      reschedule INTEGER NOT NULL,
      reschedule_channels TEXT NOT NULL,
      reschedule_audit INTEGER NOT NULL,
      reschedule_weekend TEXT NOT NULL,
      change_audit INTEGER NOT NULL,
      expire_action TEXT NOT NULL,
      people_count INTEGER NOT NULL,
      special_type TEXT NOT NULL,
      special_gender TEXT NOT NULL,
      special_region TEXT NOT NULL,
      shelf_mode TEXT NOT NULL,
      shelf_trigger TEXT NOT NULL,
      shelf_on TEXT NOT NULL,
      shelf_off TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS price_days (
      ticket_id INTEGER NOT NULL,
      day TEXT NOT NULL,
      cost_price INTEGER NOT NULL,
      retail_price INTEGER NOT NULL,
      window_price INTEGER NOT NULL,
      gate_price INTEGER NOT NULL,
      daily_stock INTEGER NOT NULL,
      daily_reserve INTEGER NOT NULL,
      stop_sale INTEGER NOT NULL,
      stop_reserve INTEGER NOT NULL,
      PRIMARY KEY (ticket_id, day)
    );
    CREATE TABLE IF NOT EXISTS settlement_days (
      ticket_id INTEGER NOT NULL,
      distributor_id INTEGER NOT NULL,
      day TEXT NOT NULL,
      price INTEGER NOT NULL,
      PRIMARY KEY (ticket_id, distributor_id, day)
    );
    CREATE TABLE IF NOT EXISTS dist_prices (
      ticket_id INTEGER NOT NULL,
      distributor_id INTEGER NOT NULL,
      enabled INTEGER NOT NULL,
      downstream INTEGER NOT NULL,
      settlement INTEGER NOT NULL,
      PRIMARY KEY (ticket_id, distributor_id)
    );
    CREATE TABLE IF NOT EXISTS channel_switches (
      ticket_id INTEGER NOT NULL,
      channel_id INTEGER NOT NULL,
      enabled INTEGER NOT NULL,
      PRIMARY KEY (ticket_id, channel_id)
    );
    CREATE TABLE IF NOT EXISTS inventory_defaults (
      venue_id INTEGER NOT NULL,
      zone_id INTEGER NOT NULL,
      reserved INTEGER NOT NULL,
      PRIMARY KEY (venue_id, zone_id)
    );
    CREATE TABLE IF NOT EXISTS inventory_default_holds (
      venue_id INTEGER NOT NULL,
      zone_id INTEGER NOT NULL,
      channel_id INTEGER NOT NULL,
      qty INTEGER NOT NULL,
      PRIMARY KEY (venue_id, zone_id, channel_id)
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY,
      venue_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      session_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT '时段',
      presale_days INTEGER NOT NULL DEFAULT 30,
      status TEXT NOT NULL DEFAULT '开售'
    );
    CREATE TABLE IF NOT EXISTS session_zones (
      session_id INTEGER NOT NULL,
      zone_id INTEGER NOT NULL,
      reserved INTEGER NOT NULL,
      PRIMARY KEY (session_id, zone_id)
    );
    CREATE TABLE IF NOT EXISTS session_holds (
      session_id INTEGER NOT NULL,
      zone_id INTEGER NOT NULL,
      channel_id INTEGER NOT NULL,
      qty INTEGER NOT NULL,
      PRIMARY KEY (session_id, zone_id, channel_id)
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY,
      order_no TEXT NOT NULL UNIQUE,
      product_id INTEGER NOT NULL,
      ticket_id INTEGER NOT NULL,
      session_id INTEGER NOT NULL,
      zone_id INTEGER,
      channel_id INTEGER NOT NULL,
      distributor_id INTEGER,
      qty INTEGER NOT NULL,
      status TEXT NOT NULL,
      pay_status TEXT NOT NULL,
      pay_method TEXT NOT NULL,
      buyer_name TEXT NOT NULL,
      buyer_phone TEXT NOT NULL,
      id_type TEXT NOT NULL,
      id_no TEXT NOT NULL,
      amount INTEGER NOT NULL,
      unit_price INTEGER NOT NULL,
      verified_count INTEGER NOT NULL DEFAULT 0,
      seller_name TEXT NOT NULL,
      supplier_name TEXT NOT NULL,
      voucher_code TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ticket_codes (
      id INTEGER PRIMARY KEY,
      order_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      seat_label TEXT NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS order_notes (
      id INTEGER PRIMARY KEY,
      order_id INTEGER NOT NULL,
      author TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS refunds (
      id INTEGER PRIMARY KEY,
      order_id INTEGER NOT NULL,
      change_type TEXT NOT NULL,
      after_qty INTEGER NOT NULL,
      applicant TEXT NOT NULL,
      applied_at TEXT NOT NULL,
      reason TEXT NOT NULL,
      refund_serial TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      flow_code TEXT NOT NULL,
      reviewer TEXT NOT NULL DEFAULT '',
      reviewed_at TEXT NOT NULL DEFAULT '',
      review_note TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS resend_logs (
      id INTEGER PRIMARY KEY,
      order_id INTEGER NOT NULL,
      actor TEXT NOT NULL,
      created_at TEXT NOT NULL,
      channel TEXT NOT NULL
    );
  `);
  const version = db.prepare("SELECT value FROM meta WHERE key = 'schema'").get() as { value: string } | undefined;
  if (!version) {
    db.prepare("INSERT INTO meta (key, value) VALUES ('schema', ?)").run(SCHEMA_VERSION);
    seed(db);
    db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    return;
  }
  if (version.value !== SCHEMA_VERSION) {
    throw new Error(`数据库版本是 ${version.value}，当前程序需要 ${SCHEMA_VERSION}。请执行 npm run db:reset 后重启。`);
  }
}

type TicketSeed = Record<string, string | number | null>;

function ticketBase(overrides: TicketSeed): TicketSeed {
  return {
    zone_id: null,
    book_start: "2026-11-01",
    book_end: "2026-12-31",
    calendar_mode: "日历票",
    daily_stock: -1,
    total_stock: -1,
    cost_price: 0,
    retail_price: 0,
    window_price: 0,
    gate_price: 0,
    weekdays: JSON.stringify([1, 2, 3, 4, 5, 6, 7]),
    need_play_date: 1,
    entry_mode: "整批入园",
    verify_before_minutes: 30,
    auto_verify: 0,
    auto_verify_hour: 21,
    precheck: 0,
    id_compare: 0,
    show_order_code: 1,
    order_hint: "请按票面场次入场。迟到视现场情况可能无法入场。",
    ticket_desc: "",
    advance_mode: "session",
    advance_value: 60,
    timed_sale: 1,
    timed_start: "09:00",
    timed_end: "22:30",
    seating_mode: "按号入座",
    sale_channels: JSON.stringify([1, 2, 3, 4, 5, 6]),
    order_min: 1,
    order_max: 6,
    realname: "仅取票人",
    limit_by: "不限制",
    limit_days: 0,
    limit_qty: 0,
    age_min: null,
    age_max: null,
    risk_tip: "演出进行中请关闭闪光灯。此为演示风险提示。",
    pay_mode: "在线支付",
    unpaid_cancel_minutes: 15,
    notify_visitor_sms: 1,
    notify_visitor_wechat: 0,
    notify_supplier_sms: 0,
    notify_distributor_sms: 0,
    sms_header: "席衡演示",
    sms_body: "您已预订{演出} {场次}，凭证码 {凭证码}。此为演示文案，不会真实发送。",
    pickup_time: "不限",
    qr_type: "门票码",
    print_mode: "每个游客一张",
    voice_mode: "播报票全称",
    voice_custom: "",
    refund_mode: "演出日期前可退",
    refund_days: 1,
    refund_audit: 1,
    pickup_refund: "取票后不可退",
    qty_change: "可减不可增",
    fee_tiers: JSON.stringify([
      { beforeHours: 72, feePercent: 0 },
      { beforeHours: 24, feePercent: 10 },
      { beforeHours: 0, feePercent: 20 },
    ]),
    reschedule: 1,
    reschedule_channels: JSON.stringify([1, 2]),
    reschedule_audit: 1,
    reschedule_weekend: "周末可改",
    change_audit: 1,
    expire_action: "不处理",
    people_count: 1,
    special_type: "无",
    special_gender: "不限",
    special_region: "",
    shelf_mode: "上下架自动控制",
    shelf_trigger: "预订时间",
    shelf_on: "",
    shelf_off: "",
    ...overrides,
  };
}

function insertTicket(db: DatabaseSync, code: string, productId: number, name: string, fields: TicketSeed) {
  const row = ticketBase(fields);
  const columns = ["code", "product_id", "name", ...Object.keys(row)];
  const values = [code, productId, name, ...Object.values(row)];
  db.prepare(`INSERT INTO tickets (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`).run(...values);
}

function fillZone(
  db: DatabaseSync,
  venueId: number,
  zoneId: number,
  rows: number,
  cols: number,
  mode: Numbering,
  unsellable?: (row: number, col: number) => boolean,
) {
  const sequence = seatSequence(cols, mode);
  const insert = db.prepare(
    `INSERT INTO seats (venue_id, zone_id, row_no, col_no, row_label, seat_no, sellable)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (let row = 1; row <= rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      insert.run(venueId, zoneId, row, col, `${row}排`, sequence[col], unsellable?.(row, col) ? 0 : 1);
    }
  }
}

function grant(db: DatabaseSync, roleId: number, access: Partial<Record<string, Access>>) {
  const insert = db.prepare("INSERT INTO role_permissions (role_id, module_key, access) VALUES (?, ?, ?)");
  for (const module of MODULES) insert.run(roleId, module.key, access[module.key] ?? "none");
}

function copyDefaults(db: DatabaseSync, sessionId: number, venueId: number) {
  const zones = db.prepare("SELECT zone_id, reserved FROM inventory_defaults WHERE venue_id = ?").all(venueId) as {
    zone_id: number;
    reserved: number;
  }[];
  const zoneInsert = db.prepare("INSERT INTO session_zones (session_id, zone_id, reserved) VALUES (?, ?, ?)");
  for (const zone of zones) zoneInsert.run(sessionId, zone.zone_id, zone.reserved);
  const holds = db.prepare("SELECT zone_id, channel_id, qty FROM inventory_default_holds WHERE venue_id = ?").all(venueId) as {
    zone_id: number;
    channel_id: number;
    qty: number;
  }[];
  const holdInsert = db.prepare(
    "INSERT INTO session_holds (session_id, zone_id, channel_id, qty) VALUES (?, ?, ?, ?)",
  );
  for (const hold of holds) holdInsert.run(sessionId, hold.zone_id, hold.channel_id, hold.qty);
}

export function applyVenueDefaults(sessionId: number, venueId: number) {
  copyDefaults(getDb(), sessionId, venueId);
}

function seed(db: DatabaseSync) {
  db.exec("BEGIN");
  try {
    const role = db.prepare("INSERT INTO roles (name, description, system) VALUES (?, ?, 1)");
    role.run("管理员", "账号、角色、权限以及全部业务模块。");
    role.run("运营", "产品、票类规则、场馆座位、场次、分销库存、开售窗口和价格。");
    role.run("客服", "订单明细、验证、备注、退票审核；销售报表只读。");
    const allWrite = Object.fromEntries(MODULES.map((module) => [module.key, "write"])) as Record<string, Access>;
    grant(db, 1, allWrite);
    grant(db, 2, {
      overview: "read",
      products: "write",
      ticket_rules: "write",
      price_calendar: "write",
      channel_sales: "write",
      venues: "write",
      seatmaps: "write",
      sessions: "write",
      inventory: "write",
      sale_windows: "write",
    });
    grant(db, 3, {
      overview: "read",
      orders: "write",
      verification: "write",
      notes: "write",
      refunds: "write",
      reports: "read",
    });

    const user = db.prepare(
      "INSERT INTO users (name, account, password_hash, role_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const created = "2026-10-20 09:00";
    user.run("沈清和", "guanli", hashPassword("XiHeng-2401"), 1, "enabled", created);
    user.run("周宁", "yunying", hashPassword("XiHeng-2402"), 2, "enabled", created);
    user.run("何清", "kefu", hashPassword("XiHeng-2403"), 3, "enabled", created);
    user.run("梁停用", "tingyong", hashPassword("XiHeng-2404"), 3, "disabled", created);

    db.prepare("INSERT INTO distributors (name, group_name) VALUES (?, ?)").run("云启旅行社", "华东地接");
    db.prepare("INSERT INTO distributors (name, group_name) VALUES (?, ?)").run("澄光文旅", "城市合伙人");
    db.prepare("INSERT INTO distributors (name, group_name) VALUES (?, ?)").run("镜厅企业客户", "协议客户");
    const channel = db.prepare("INSERT INTO channels (name, kind, distributor_id) VALUES (?, ?, ?)");
    channel.run("官网直销", "直销", null);
    channel.run("窗口直销", "直销", null);
    channel.run("手持机", "直销", null);
    channel.run("云启旅行", "分销", 1);
    channel.run("澄光文旅", "分销", 2);
    channel.run("企业团购", "分销", 3);

    const venue = db.prepare(
      `INSERT INTO venues (code, name, address, map_note, display_mode, fuzzy_ample, fuzzy_tight)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    venue.run(
      "XH-V01",
      "江城大剧院 · 镜厅",
      "江城市镜湖路 18 号",
      "镜框式舞台。池座八排、楼座四排，左右侧厢以中间过道分开。",
      "fuzzy",
      40,
      15,
    );
    venue.run(
      "XH-V02",
      "江城实验小剧场",
      "江城市镜湖路 18 号东侧",
      "黑匣子，观众席与阶梯后区两块。库存对客按实时数量显示。",
      "realtime",
      40,
      15,
    );

    const zone = db.prepare(
      `INSERT INTO zones (venue_id, name, color, rows_n, cols_n, numbering, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    zone.run(1, "池座", "#c4552a", 8, 10, "正序", 1);
    zone.run(1, "楼座", "#1f6f64", 4, 12, "倒序", 2);
    zone.run(1, "侧厢", "#b0893e", 2, 8, "奇数在左", 3);
    zone.run(2, "观众席", "#3d4f7c", 5, 8, "正序", 1);
    zone.run(2, "阶梯后区", "#6b4c7a", 3, 8, "倒序", 2);

    fillZone(db, 1, 1, 8, 10, "正序");
    fillZone(db, 1, 2, 4, 12, "倒序");
    fillZone(db, 1, 3, 2, 8, "奇数在左");
    fillZone(db, 2, 4, 5, 8, "正序");
    fillZone(db, 2, 5, 3, 8, "倒序");

    const reserve = db.prepare("INSERT INTO inventory_defaults (venue_id, zone_id, reserved) VALUES (?, ?, ?)");
    reserve.run(1, 1, 8);
    reserve.run(1, 2, 4);
    reserve.run(1, 3, 2);
    reserve.run(2, 4, 0);
    reserve.run(2, 5, 0);
    const hold = db.prepare(
      "INSERT INTO inventory_default_holds (venue_id, zone_id, channel_id, qty) VALUES (?, ?, ?, ?)",
    );
    hold.run(1, 1, 6, 16);
    hold.run(1, 3, 6, 4);

    const product = db.prepare(
      `INSERT INTO products (
        code, name, product_type, area, terminal_no, address, published_at, remark, hue,
        intro, director, traffic, notice, supplier_phone, venue_id, status
      ) VALUES (?, ?, '演出', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '出售中')`,
    );
    product.run(
      "XH-P1001",
      "《江城夜航》固定场",
      "江城 · 镜湖区",
      "T-JH-01",
      "江城市镜湖路 18 号江城大剧院",
      "2026-10-20 10:00",
      "示例剧目。价格、库存和订单都是演示数据。",
      16,
      "夜航把一座城没说完的话交给江面。两岸灯火依次亮起，船上的人在靠岸前交换一个秘密。本简介为演示文本，不是真实在演剧目。",
      "演示导演 沈清和",
      "地铁镜湖站 B 口步行 8 分钟。剧院北门可临时下客，地下车库入口在镜湖路辅路。",
      "开演前 30 分钟开始检票。迟到请联系检票口。儿童须符合票面年龄。禁止携带闪光灯入场。",
      "400-000-1860",
      1,
    );
    product.run(
      "XH-P1002",
      "《灯河》流水场",
      "江城 · 镜湖区",
      "T-JH-02",
      "江城市镜湖路 18 号东侧实验小剧场",
      "2026-10-28 15:00",
      "同一天多场的流水演出示例。",
      210,
      "一条由台灯连成的河穿过观众席。每场 70 分钟，当日连续开场。演示文本。",
      "演示导演 梁晚白",
      "与镜厅共用北门，入场请走东侧小剧场通道。",
      "流水场不设迟到入场。请按票面场次提前 15 分钟候场。",
      "400-000-1860",
      2,
    );

    insertTicket(db, "XH-T2101", 1, "池座成人票", {
      zone_id: 1,
      daily_stock: 200,
      total_stock: 2000,
      cost_price: 180,
      retail_price: 280,
      window_price: 260,
      gate_price: 300,
      advance_mode: "session",
      advance_value: 120,
      ticket_desc: "镜厅池座，按号入座。含一张演职人员节目单（演示）。",
      order_max: 6,
      verify_before_minutes: 40,
    });
    insertTicket(db, "XH-T2102", 1, "楼座成人票", {
      zone_id: 2,
      daily_stock: 120,
      total_stock: 1500,
      cost_price: 90,
      retail_price: 160,
      window_price: 150,
      gate_price: 180,
      advance_value: 60,
      ticket_desc: "二层楼座，视线略俯。价格独立于池座。",
    });
    insertTicket(db, "XH-T2103", 1, "楼座学生票", {
      zone_id: 2,
      daily_stock: 40,
      total_stock: 400,
      cost_price: 60,
      retail_price: 100,
      window_price: 90,
      gate_price: 120,
      advance_mode: "day",
      advance_value: 0,
      timed_end: "21:00",
      sale_channels: JSON.stringify([1, 2, 4, 5]),
      order_max: 4,
      realname: "全部游客",
      limit_by: "取票人",
      limit_days: 30,
      limit_qty: 4,
      age_min: 6,
      age_max: 25,
      id_compare: 1,
      entry_mode: "分批入园",
      refund_mode: "有效期内可退",
      refund_days: 0,
      special_type: "学生票",
      voice_mode: "自定义",
      voice_custom: "学生票，请核验学生证件",
      ticket_desc: "限 6–25 岁。入场需人证比对。与楼座成人票分属同一分区、不同票价。",
      people_count: 1,
    });
    insertTicket(db, "XH-T2104", 1, "侧厢票", {
      zone_id: 3,
      daily_stock: 16,
      total_stock: 200,
      cost_price: 240,
      retail_price: 420,
      window_price: 400,
      gate_price: 480,
      order_max: 4,
      advance_value: 180,
      pickup_time: "开演日期当日可取",
      qr_type: "门票码",
      ticket_desc: "侧厢每侧四座，中间为过道。企业团购对侧厢有独立库存。",
      shelf_mode: "发布上架",
    });
    insertTicket(db, "XH-T2201", 2, "观众席票", {
      zone_id: 4,
      book_end: "2026-12-15",
      daily_stock: 80,
      total_stock: 800,
      cost_price: 70,
      retail_price: 120,
      window_price: 110,
      gate_price: 140,
      advance_value: 30,
      timed_end: "21:00",
      sale_channels: JSON.stringify([1, 2, 4, 5]),
      shelf_mode: "发布上架",
      ticket_desc: "小剧场观众席，按号入座。",
      refund_mode: "随时退",
      refund_audit: 0,
    });
    insertTicket(db, "XH-T2202", 2, "后区票", {
      zone_id: 5,
      book_end: "2026-12-15",
      daily_stock: 60,
      total_stock: 600,
      cost_price: 50,
      retail_price: 90,
      window_price: 80,
      gate_price: 100,
      seating_mode: "自由入座",
      advance_value: 30,
      timed_end: "21:00",
      sale_channels: JSON.stringify([1, 2, 5]),
      shelf_mode: "发布上架",
      ticket_desc: "阶梯后区，自由入座，不绑座位号。",
      order_max: 8,
    });

    const directSwitch = db.prepare("INSERT INTO channel_switches (ticket_id, channel_id, enabled) VALUES (?, ?, ?)");
    const whitelists = [
      [1, 2, 3, 4, 5, 6],
      [1, 2, 3, 4, 5, 6],
      [1, 2, 4, 5],
      [1, 2, 3, 4, 5, 6],
      [1, 2, 4, 5],
      [1, 2, 5],
    ];
    whitelists.forEach((list, index) => {
      for (const channelId of [1, 2, 3]) directSwitch.run(index + 1, channelId, list.includes(channelId) ? 1 : 0);
    });

    const dist = db.prepare(
      "INSERT INTO dist_prices (ticket_id, distributor_id, enabled, downstream, settlement) VALUES (?, ?, ?, ?, ?)",
    );
    const distRows: [number, number, number, number, number][] = [
      [1, 1, 1, 1, 240],
      [1, 2, 1, 1, 250],
      [1, 3, 1, 0, 230],
      [2, 1, 1, 1, 130],
      [2, 2, 1, 0, 135],
      [2, 3, 0, 0, 120],
      [3, 1, 1, 0, 80],
      [3, 2, 1, 0, 85],
      [3, 3, 0, 0, 80],
      [4, 1, 1, 0, 360],
      [4, 2, 0, 0, 360],
      [4, 3, 1, 0, 340],
      [5, 1, 1, 1, 100],
      [5, 2, 1, 0, 100],
      [5, 3, 0, 0, 100],
      [6, 1, 0, 0, 70],
      [6, 2, 1, 0, 75],
      [6, 3, 0, 0, 70],
    ];
    for (const row of distRows) dist.run(...row);

    const price = db.prepare(
      `INSERT INTO price_days (
        ticket_id, day, cost_price, retail_price, window_price, gate_price, daily_stock, daily_reserve, stop_sale, stop_reserve
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (let cursor = "2026-11-01"; cursor <= "2026-12-31"; cursor = addDays(cursor, 1)) {
      const weekend = weekdayOf(cursor) >= 6;
      if (weekend) {
        price.run(1, cursor, 200, 320, 300, 340, 100, 0, 0, 0);
        price.run(4, cursor, 260, 460, 440, 500, 16, 0, 0, 0);
      }
    }
    price.run(3, "2026-11-11", 60, 100, 90, 120, 0, 0, 1, 1);
    price.run(1, "2026-11-18", 180, 280, 260, 300, 40, 6, 0, 0);

    const settle = db.prepare(
      "INSERT INTO settlement_days (ticket_id, distributor_id, day, price) VALUES (?, ?, ?, ?)",
    );
    for (const day of ["2026-11-15", "2026-11-21", "2026-11-22"]) {
      settle.run(1, 1, day, 260);
      settle.run(1, 2, day, 270);
      settle.run(1, 3, day, 250);
    }

    const sessionInsert = db.prepare(
      `INSERT INTO sessions (venue_id, product_id, name, session_date, start_time, end_time, mode, presale_days, status)
       VALUES (?, ?, ?, ?, ?, ?, '时段', ?, ?)`,
    );
    const night: [string, string, string][] = [
      ["2026-11-08", "19:30", "21:40"],
      ["2026-11-13", "19:30", "21:40"],
      ["2026-11-14", "19:30", "21:40"],
      ["2026-11-15", "14:30", "16:40"],
      ["2026-11-15", "19:30", "21:40"],
      ["2026-11-20", "19:30", "21:40"],
      ["2026-11-21", "14:30", "16:40"],
      ["2026-11-21", "19:30", "21:40"],
      ["2026-11-22", "19:30", "21:40"],
    ];
    for (const [date, start, end] of night) {
      const status = date < "2026-11-13" ? "停售" : "开售";
      const name = start === "14:30" ? "日场" : "晚场";
      const info = sessionInsert.run(1, 1, name, date, start, end, 30, status);
      copyDefaults(db, Number(info.lastInsertRowid), 1);
    }
    const flow: [string, string, string, string][] = [
      ["2026-11-13", "15:00", "16:10", "一场"],
      ["2026-11-13", "17:00", "18:10", "二场"],
      ["2026-11-13", "19:30", "20:40", "三场"],
      ["2026-11-14", "15:00", "16:10", "一场"],
      ["2026-11-15", "15:00", "16:10", "一场"],
      ["2026-11-15", "19:30", "20:40", "三场"],
    ];
    for (const [date, start, end, name] of flow) {
      const info = sessionInsert.run(2, 2, name, date, start, end, 14, "开售");
      copyDefaults(db, Number(info.lastInsertRowid), 2);
    }

    const cursors = new Map<number, { row_label: string; seat_no: number }[]>();
    function take(zoneId: number, zoneName: string, qty: number) {
      if (!cursors.has(zoneId)) {
        cursors.set(
          zoneId,
          db
            .prepare(
              "SELECT row_label, seat_no FROM seats WHERE zone_id = ? AND sellable = 1 ORDER BY row_no, col_no",
            )
            .all(zoneId) as { row_label: string; seat_no: number }[],
        );
      }
      const bucket = cursors.get(zoneId)!;
      const picked = bucket.splice(0, qty);
      if (picked.length < qty) throw new Error(`分区 ${zoneName} 演示座位不足`);
      return picked.map((seat) => seatLabel(zoneName, seat.row_label, seat.seat_no));
    }

    type OrderSeed = {
      no: string;
      ticketId: number;
      zoneId: number;
      zoneName: string;
      sessionDate: string;
      start: string;
      channelId: number;
      qty: number;
      status: string;
      payStatus: string;
      payMethod: string;
      buyer: string;
      phone: string;
      unit: number;
      seller: string;
      createdAt: string;
      verified?: number;
      seats?: boolean;
    };

    const orders: OrderSeed[] = [
      { no: "XH20261113001", ticketId: 1, zoneId: 1, zoneName: "池座", sessionDate: "2026-11-13", start: "19:30", channelId: 1, qty: 2, status: "未使用", payStatus: "已支付", payMethod: "微信支付", buyer: "林晓舟", phone: "13800001021", unit: 280, seller: "周宁", createdAt: "2026-11-12 10:16" },
      { no: "XH20261113002", ticketId: 3, zoneId: 2, zoneName: "楼座", sessionDate: "2026-11-13", start: "19:30", channelId: 2, qty: 2, status: "部分使用", payStatus: "已支付", payMethod: "窗口现金", buyer: "陈书宁", phone: "13800001022", unit: 100, seller: "何清", createdAt: "2026-11-13 18:40", verified: 1 },
      { no: "XH20261113003", ticketId: 1, zoneId: 1, zoneName: "池座", sessionDate: "2026-11-13", start: "19:30", channelId: 6, qty: 4, status: "未使用", payStatus: "已支付", payMethod: "对公转账", buyer: "周予安", phone: "13800001023", unit: 230, seller: "周宁", createdAt: "2026-11-10 09:12" },
      { no: "XH20261108004", ticketId: 2, zoneId: 2, zoneName: "楼座", sessionDate: "2026-11-08", start: "19:30", channelId: 4, qty: 3, status: "已使用", payStatus: "已支付", payMethod: "支付宝", buyer: "何清越", phone: "13800001024", unit: 130, seller: "周宁", createdAt: "2026-11-06 11:02", verified: 3 },
      { no: "XH20261114005", ticketId: 1, zoneId: 1, zoneName: "池座", sessionDate: "2026-11-14", start: "19:30", channelId: 1, qty: 2, status: "被取消", payStatus: "已退款", payMethod: "微信支付", buyer: "苏晚宁", phone: "13800001025", unit: 320, seller: "何清", createdAt: "2026-11-11 16:44" },
      { no: "XH20261115006", ticketId: 1, zoneId: 1, zoneName: "池座", sessionDate: "2026-11-15", start: "19:30", channelId: 6, qty: 6, status: "未使用", payStatus: "已支付", payMethod: "对公转账", buyer: "江衡", phone: "13800001026", unit: 250, seller: "周宁", createdAt: "2026-11-09 14:20" },
      { no: "XH20261115007", ticketId: 1, zoneId: 1, zoneName: "池座", sessionDate: "2026-11-15", start: "19:30", channelId: 6, qty: 4, status: "已使用", payStatus: "已支付", payMethod: "对公转账", buyer: "裴宁", phone: "13800001027", unit: 250, seller: "周宁", createdAt: "2026-11-09 15:02", verified: 4 },
      { no: "XH20261115008", ticketId: 1, zoneId: 1, zoneName: "池座", sessionDate: "2026-11-15", start: "19:30", channelId: 1, qty: 10, status: "未使用", payStatus: "已支付", payMethod: "微信支付", buyer: "唐小满", phone: "13800001028", unit: 320, seller: "周宁", createdAt: "2026-11-12 20:11" },
      { no: "XH20261115009", ticketId: 1, zoneId: 1, zoneName: "池座", sessionDate: "2026-11-15", start: "19:30", channelId: 4, qty: 12, status: "未使用", payStatus: "已支付", payMethod: "支付宝", buyer: "沈知夏", phone: "13800001029", unit: 260, seller: "周宁", createdAt: "2026-11-12 09:33" },
      { no: "XH20261115010", ticketId: 1, zoneId: 1, zoneName: "池座", sessionDate: "2026-11-15", start: "19:30", channelId: 2, qty: 8, status: "未使用", payStatus: "已支付", payMethod: "窗口现金", buyer: "梁秋白", phone: "13800001030", unit: 300, seller: "何清", createdAt: "2026-11-13 11:18" },
      { no: "XH20261115011", ticketId: 1, zoneId: 1, zoneName: "池座", sessionDate: "2026-11-15", start: "19:30", channelId: 5, qty: 22, status: "未使用", payStatus: "已支付", payMethod: "微信支付", buyer: "许南星", phone: "13800001031", unit: 270, seller: "周宁", createdAt: "2026-11-08 17:40" },
      { no: "XH20261115012", ticketId: 2, zoneId: 2, zoneName: "楼座", sessionDate: "2026-11-15", start: "19:30", channelId: 1, qty: 20, status: "未使用", payStatus: "已支付", payMethod: "微信支付", buyer: "宋拾光", phone: "13800001032", unit: 160, seller: "周宁", createdAt: "2026-11-13 08:12" },
      { no: "XH20261115013", ticketId: 4, zoneId: 3, zoneName: "侧厢", sessionDate: "2026-11-15", start: "19:30", channelId: 6, qty: 4, status: "未使用", payStatus: "已支付", payMethod: "对公转账", buyer: "顾承川", phone: "13800001033", unit: 340, seller: "周宁", createdAt: "2026-11-07 19:05" },
      { no: "XH20261120014", ticketId: 1, zoneId: 1, zoneName: "池座", sessionDate: "2026-11-20", start: "19:30", channelId: 1, qty: 2, status: "待确认", payStatus: "已支付", payMethod: "支付宝", buyer: "赵明川", phone: "13800001034", unit: 280, seller: "周宁", createdAt: "2026-11-13 09:48" },
      { no: "XH20261113015", ticketId: 5, zoneId: 4, zoneName: "观众席", sessionDate: "2026-11-13", start: "15:00", channelId: 1, qty: 3, status: "未使用", payStatus: "已支付", payMethod: "微信支付", buyer: "叶知微", phone: "13800001035", unit: 120, seller: "何清", createdAt: "2026-11-12 13:22", seats: true },
    ];

    const orderInsert = db.prepare(
      `INSERT INTO orders (
        order_no, product_id, ticket_id, session_id, zone_id, channel_id, distributor_id, qty, status,
        pay_status, pay_method, buyer_name, buyer_phone, id_type, id_no, amount, unit_price, verified_count,
        seller_name, supplier_name, voucher_code, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '其他', ?, ?, ?, ?, ?, '江城大剧院票务（演示）', ?, ?)`,
    );
    const codeInsert = db.prepare(
      "INSERT INTO ticket_codes (order_id, code, seat_label, status) VALUES (?, ?, ?, ?)",
    );
    const channelDist: Record<number, number | null> = { 1: null, 2: null, 3: null, 4: 1, 5: 2, 6: 3 };
    const ticketProduct: Record<number, number> = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 2, 6: 2 };

    orders.forEach((order, index) => {
      const session = db
        .prepare("SELECT id FROM sessions WHERE product_id = ? AND session_date = ? AND start_time = ?")
        .get(ticketProduct[order.ticketId], order.sessionDate, order.start) as { id: number };
      const labels = order.seats === false ? [] : take(order.zoneId, order.zoneName, order.qty);
      const info = orderInsert.run(
        order.no,
        ticketProduct[order.ticketId],
        order.ticketId,
        session.id,
        order.zoneId,
        order.channelId,
        channelDist[order.channelId],
        order.qty,
        order.status,
        order.payStatus,
        order.payMethod,
        order.buyer,
        order.phone,
        `演示证件-${String(index + 21).padStart(5, "0")}`,
        order.unit * order.qty,
        order.unit,
        order.verified ?? (order.status === "已使用" ? order.qty : 0),
        order.seller,
        `VX${order.no.slice(-6)}`,
        order.createdAt,
      );
      const orderId = Number(info.lastInsertRowid);
      for (let n = 0; n < order.qty; n += 1) {
        let status = "未使用";
        if (order.status === "被取消") status = "被取消";
        else if (order.status === "已使用") status = "已使用";
        else if (order.status === "部分使用") status = n < (order.verified ?? 0) ? "已使用" : "未使用";
        else if (order.status === "待确认") status = "待确认";
        codeInsert.run(orderId, `TP${order.no.slice(2)}${String(n + 1).padStart(2, "0")}`, labels[n] ?? "自由入座", status);
      }
    });

    db.prepare("INSERT INTO order_notes (order_id, author, content, created_at) VALUES (?, ?, ?, ?)").run(
      2,
      "何清",
      "已验证 1 张。另一张客人表示随行人稍后到场。",
      "2026-11-13 19:06",
    );

    const refund = db.prepare(
      `INSERT INTO refunds (
        order_id, change_type, after_qty, applicant, applied_at, reason, refund_serial, status, flow_code, reviewer, reviewed_at, review_note
      ) VALUES (?, '退票', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    refund.run(5, 0, "苏晚宁", "2026-11-12 09:18", "行程冲突，整单退票", "RF20261112018", "同意", "FL-8K21", "何清", "2026-11-12 09:40", "符合演出日前可退，手续费按 0% 档。");
    refund.run(1, 0, "林晓舟", "2026-11-13 11:05", "同行人无法到场，申请整单退票", "", "等待审核", "FL-7A02", "", "", "");
    refund.run(4, 3, "何清越", "2026-11-09 10:12", "演出已结束仍希望退票", "", "拒绝", "FL-2M17", "何清", "2026-11-09 11:02", "票已使用，且已过演出日，不符合退改规则。");

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
