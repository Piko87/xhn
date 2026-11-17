"use client";

import { useState } from "react";
import { TICKET_TABS } from "@/lib/constants";
import { WEEKDAY_LABELS } from "@/lib/time";
import type { TicketInput } from "@/lib/types";
import { saveTicket } from "@/server/catalog-actions";

type Channel = { id: number; name: string; kind: string };
type Zone = { id: number; name: string };

export function TicketEditor({
  ticket,
  zones,
  channels,
  supplierPhone,
  summary,
  editable,
}: {
  ticket: TicketInput;
  zones: Zone[];
  channels: Channel[];
  supplierPhone: string;
  summary: { shelf: string; booking: string; advance: string; timed: string };
  editable: boolean;
}) {
  const [tab, setTab] = useState<(typeof TICKET_TABS)[number]>("类型");
  const [form, setForm] = useState(ticket);
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, setPending] = useState(false);

  function patch(partial: Partial<TicketInput>) {
    setForm((current) => ({ ...current, ...partial }));
  }

  async function onSave() {
    setPending(true);
    const result = await saveTicket(form);
    setPending(false);
    setOk(!!result?.ok);
    setMessage(result?.message ?? "保存失败");
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="grid-2">
          <label className="field">
            <span>票名称</span>
            <input value={form.name} disabled={!editable} onChange={(event) => patch({ name: event.target.value })} />
          </label>
          <label className="field">
            <span>日历模式</span>
            <select value={form.calendar_mode} disabled={!editable} onChange={(event) => patch({ calendar_mode: event.target.value })}>
              <option>日历票</option>
              <option>有效期票</option>
            </select>
          </label>
          <label className="field">
            <span>预订开始</span>
            <input type="date" value={form.book_start} disabled={!editable} onChange={(event) => patch({ book_start: event.target.value })} />
          </label>
          <label className="field">
            <span>预订结束</span>
            <input type="date" value={form.book_end} disabled={!editable} onChange={(event) => patch({ book_end: event.target.value })} />
          </label>
          <label className="field">
            <span>日库存（-1 为不限）</span>
            <input type="number" value={form.daily_stock} disabled={!editable} onChange={(event) => patch({ daily_stock: Number(event.target.value) })} />
          </label>
          <label className="field">
            <span>总库存（-1 为不限）</span>
            <input type="number" value={form.total_stock} disabled={!editable} onChange={(event) => patch({ total_stock: Number(event.target.value) })} />
          </label>
          {(["cost_price", "retail_price", "window_price", "gate_price"] as const).map((key) => (
            <label className="field" key={key}>
              <span>{{ cost_price: "成本价", retail_price: "建议零售价", window_price: "窗口价", gate_price: "门市价" }[key]}</span>
              <input type="number" value={form[key]} disabled={!editable} onChange={(event) => patch({ [key]: Number(event.target.value) })} />
            </label>
          ))}
        </div>
        <div className="stack" style={{ marginTop: 12 }}>
          <span className="note">可售星期</span>
          <div className="choice-row">
            <button type="button" className="btn small" disabled={!editable} onClick={() => patch({ weekdays: [1, 2, 3, 4, 5, 6, 7] })}>全选</button>
            <button type="button" className="btn small" disabled={!editable} onClick={() => patch({ weekdays: [1, 2, 3, 4, 5] })}>平时</button>
            <button type="button" className="btn small" disabled={!editable} onClick={() => patch({ weekdays: [6, 7] })}>周末</button>
            {WEEKDAY_LABELS.map((label, index) => {
              const day = index + 1;
              const on = form.weekdays.includes(day);
              return (
                <button
                  type="button"
                  key={label}
                  disabled={!editable}
                  className={`choice ${on ? "on" : ""}`}
                  onClick={() => patch({ weekdays: on ? form.weekdays.filter((item) => item !== day) : [...form.weekdays, day].sort() })}
                >
                  周{label}
                </button>
              );
            })}
          </div>
          <div className="chips">
            <span className="chip">状态 {summary.shelf}</span>
            <span className="chip">预订 {summary.booking}</span>
            <span className="chip">{summary.advance}</span>
            <span className="chip">{summary.timed}</span>
          </div>
        </div>
      </section>

      <div className="tabs">
        {TICKET_TABS.map((item) => (
          <button key={item} type="button" className={tab === item ? "on" : ""} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </div>

      <section className="card">
        {tab === "类型" && (
          <div>
            <p className="hint">演出票默认需要选择场次日期。有效期票可以不选游玩日期。</p>
            <div className="choice-row">
              {[
                [1, "需选游玩日期"],
                [0, "无需选游玩日期"],
              ].map(([value, label]) => (
                <label key={label} className={`choice ${form.need_play_date === value ? "on" : ""}`}>
                  <input type="radio" checked={form.need_play_date === value} disabled={!editable} onChange={() => patch({ need_play_date: Number(value) })} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        )}

        {tab === "验证" && (
          <div className="stack">
            <p className="hint">验证时间固定在场次开始到结束之间，可额外提前若干分钟。客服仍可做窗口外的人工验证。</p>
            <div className="choice-row">
              {["整批入园", "分批入园"].map((item) => (
                <label key={item} className={`choice ${form.entry_mode === item ? "on" : ""}`}>
                  <input type="radio" checked={form.entry_mode === item} disabled={!editable} onChange={() => patch({ entry_mode: item })} />
                  {item}
                </label>
              ))}
            </div>
            <div className="grid-3">
              <label className="field"><span>开演前可验证（分钟）</span><input type="number" value={form.verify_before_minutes} disabled={!editable} onChange={(event) => patch({ verify_before_minutes: Number(event.target.value) })} /></label>
              <label className="field"><span>自动验证钟点</span><input type="number" min={0} max={23} value={form.auto_verify_hour} disabled={!editable || !form.auto_verify} onChange={(event) => patch({ auto_verify_hour: Number(event.target.value) })} /></label>
            </div>
            <div className="check-row">
              <Check label="游玩日自动验证" on={!!form.auto_verify} disabled={!editable} onClick={() => patch({ auto_verify: form.auto_verify ? 0 : 1 })} />
              <Check label="预检模式" on={!!form.precheck} disabled={!editable} onClick={() => patch({ precheck: form.precheck ? 0 : 1 })} />
              <Check label="刷身份证人证比对" on={!!form.id_compare} disabled={!editable} onClick={() => patch({ id_compare: form.id_compare ? 0 : 1 })} />
              <Check label="订单展码" on={!!form.show_order_code} disabled={!editable} onClick={() => patch({ show_order_code: form.show_order_code ? 0 : 1 })} />
            </div>
            <label className="field"><span>订单上提示文字</span><textarea value={form.order_hint} disabled={!editable} onChange={(event) => patch({ order_hint: event.target.value })} /></label>
          </div>
        )}

        {tab === "下单" && (
          <div className="stack">
            <label className="field">
              <span>座位分区</span>
              <select value={form.zone_id ?? ""} disabled={!editable} onChange={(event) => patch({ zone_id: event.target.value ? Number(event.target.value) : null })}>
                <option value="">不使用座位分区</option>
                {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
              </select>
            </label>
            <p className="hint">分区票价不画在座位图上。不同分区使用不同票类，各自维护价格日历。</p>
            <label className="field"><span>票说明</span><textarea value={form.ticket_desc} disabled={!editable} onChange={(event) => patch({ ticket_desc: event.target.value })} /></label>
            <div className="grid-3">
              <label className="field">
                <span>提前预订</span>
                <select value={form.advance_mode} disabled={!editable} onChange={(event) => patch({ advance_mode: event.target.value })}>
                  <option value="day">按天</option>
                  <option value="session">按场次开始时间</option>
                </select>
              </label>
              <label className="field">
                <span>{form.advance_mode === "day" ? "至少提前天数" : "开演前停售（分钟）"}</span>
                <input type="number" value={form.advance_value} disabled={!editable} onChange={(event) => patch({ advance_value: Number(event.target.value) })} />
              </label>
            </div>
            <Check label="启用限时售卖（每天的钟点，不是日期范围）" on={!!form.timed_sale} disabled={!editable} onClick={() => patch({ timed_sale: form.timed_sale ? 0 : 1 })} />
            <div className="grid-2">
              <label className="field"><span>每日开始</span><input value={form.timed_start} placeholder="09:00" disabled={!editable || !form.timed_sale} onChange={(event) => patch({ timed_start: event.target.value })} /></label>
              <label className="field"><span>每日结束</span><input value={form.timed_end} placeholder="22:30" disabled={!editable || !form.timed_sale} onChange={(event) => patch({ timed_end: event.target.value })} /></label>
            </div>
            <div className="choice-row">
              {["按号入座", "自由入座"].map((item) => (
                <label key={item} className={`choice ${form.seating_mode === item ? "on" : ""}`}>
                  <input type="radio" checked={form.seating_mode === item} disabled={!editable} onChange={() => patch({ seating_mode: item })} />
                  {item}
                </label>
              ))}
            </div>
            <p className="hint">可售渠道是白名单，决定资格，不决定数量。数量在分销库存里配置。</p>
            <div className="check-row">
              {channels.map((channel) => {
                const on = form.sale_channels.includes(channel.id);
                return (
                  <button
                    type="button"
                    key={channel.id}
                    disabled={!editable}
                    className={`check ${on ? "on" : ""}`}
                    onClick={() => patch({ sale_channels: on ? form.sale_channels.filter((id) => id !== channel.id) : [...form.sale_channels, channel.id] })}
                  >
                    {channel.kind} · {channel.name}
                  </button>
                );
              })}
            </div>
            <div className="grid-3">
              <label className="field"><span>最少张数</span><input type="number" value={form.order_min} disabled={!editable} onChange={(event) => patch({ order_min: Number(event.target.value) })} /></label>
              <label className="field"><span>最多张数</span><input type="number" value={form.order_max} disabled={!editable} onChange={(event) => patch({ order_max: Number(event.target.value) })} /></label>
              <label className="field">
                <span>实名制</span>
                <select value={form.realname} disabled={!editable} onChange={(event) => patch({ realname: event.target.value })}>
                  {["不实名", "仅取票人", "全部游客", "取票人及游客"].map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="field">
                <span>购票限制对象</span>
                <select value={form.limit_by} disabled={!editable} onChange={(event) => patch({ limit_by: event.target.value })}>
                  {["不限制", "取票人", "游客"].map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="field"><span>限制天数</span><input type="number" value={form.limit_days} disabled={!editable} onChange={(event) => patch({ limit_days: Number(event.target.value) })} /></label>
              <label className="field"><span>限制张数</span><input type="number" value={form.limit_qty} disabled={!editable} onChange={(event) => patch({ limit_qty: Number(event.target.value) })} /></label>
              <label className="field"><span>适合年龄起</span><input type="number" value={form.age_min ?? ""} disabled={!editable} onChange={(event) => patch({ age_min: event.target.value === "" ? null : Number(event.target.value) })} /></label>
              <label className="field"><span>适合年龄止</span><input type="number" value={form.age_max ?? ""} disabled={!editable} onChange={(event) => patch({ age_max: event.target.value === "" ? null : Number(event.target.value) })} /></label>
            </div>
            <label className="field"><span>下单风险提示</span><textarea value={form.risk_tip} disabled={!editable} onChange={(event) => patch({ risk_tip: event.target.value })} /></label>
          </div>
        )}

        {tab === "支付" && (
          <div className="stack">
            <label className="choice on"><input type="radio" checked disabled /> 在线支付（本期固定）</label>
            <label className="field" style={{ maxWidth: 280 }}>
              <span>未支付自动取消（分钟）</span>
              <input type="number" value={form.unpaid_cancel_minutes} disabled={!editable} onChange={(event) => patch({ unpaid_cancel_minutes: Number(event.target.value) })} />
            </label>
            <p className="hint">这里只保存规则。演示订单直接记为已支付，没有支付网关。</p>
          </div>
        )}

        {tab === "通知" && (
          <div className="stack">
            <p className="hint">短信按条计费。供应商电话来自产品，修改后对该产品全部票类生效。自定义文案只保存，不申报、不发送。</p>
            <p>供应商电话：{supplierPhone || "未填写"}</p>
            <div className="check-row">
              <Check label="短信通知游客" on={!!form.notify_visitor_sms} disabled={!editable} onClick={() => patch({ notify_visitor_sms: form.notify_visitor_sms ? 0 : 1 })} />
              <Check label="微信通知游客" on={!!form.notify_visitor_wechat} disabled={!editable} onClick={() => patch({ notify_visitor_wechat: form.notify_visitor_wechat ? 0 : 1 })} />
              <Check label="短信通知供应商" on={!!form.notify_supplier_sms} disabled={!editable} onClick={() => patch({ notify_supplier_sms: form.notify_supplier_sms ? 0 : 1 })} />
              <Check label="短信通知分销商" on={!!form.notify_distributor_sms} disabled={!editable} onClick={() => patch({ notify_distributor_sms: form.notify_distributor_sms ? 0 : 1 })} />
            </div>
            <label className="field"><span>短信抬头</span><input value={form.sms_header} disabled={!editable} onChange={(event) => patch({ sms_header: event.target.value })} /></label>
            <label className="field"><span>短信内容</span><textarea value={form.sms_body} disabled={!editable} onChange={(event) => patch({ sms_body: event.target.value })} /></label>
          </div>
        )}

        {tab === "取票" && (
          <div className="stack">
            <RadioGroup label="取票时间" value={form.pickup_time} options={["不限", "开演日期当日可取"]} disabled={!editable} onChange={(value) => patch({ pickup_time: value })} />
            <RadioGroup label="二维码" value={form.qr_type} options={["订单凭证码", "门票码"]} disabled={!editable} onChange={(value) => patch({ qr_type: value })} />
            <RadioGroup label="打印" value={form.print_mode} options={["每个游客一张", "每笔订单一张"]} disabled={!editable} onChange={(value) => patch({ print_mode: value })} />
            <RadioGroup label="闸机播报" value={form.voice_mode} options={["播报票全称", "自定义", "自由组合"]} disabled={!editable} onChange={(value) => patch({ voice_mode: value })} />
            <label className="field"><span>自定义播报</span><input value={form.voice_custom} disabled={!editable} onChange={(event) => patch({ voice_custom: event.target.value })} /></label>
          </div>
        )}

        {tab === "退改" && (
          <div className="stack">
            <RadioGroup label="退票政策" value={form.refund_mode} options={["不可退", "有效期内可退", "演出日期前可退", "随时退"]} disabled={!editable} onChange={(value) => patch({ refund_mode: value })} />
            {form.refund_mode === "演出日期前可退" && (
              <label className="field" style={{ maxWidth: 240 }}><span>演出日前可退天数</span><input type="number" value={form.refund_days} disabled={!editable} onChange={(event) => patch({ refund_days: Number(event.target.value) })} /></label>
            )}
            <Check label="退票需人工审核" on={!!form.refund_audit} disabled={!editable} onClick={() => patch({ refund_audit: form.refund_audit ? 0 : 1 })} />
            <RadioGroup label="取票后退票" value={form.pickup_refund} options={["取票后可退", "取票后不可退", "部分取票可退"]} disabled={!editable} onChange={(value) => patch({ pickup_refund: value })} />
            <RadioGroup label="更改数量" value={form.qty_change} options={["可减不可增", "可减可增"]} disabled={!editable} onChange={(value) => patch({ qty_change: value })} />
            <div>
              <p className="hint">手续费按距离开演的小时数分档，百分比。</p>
              {form.fee_tiers.map((tier, index) => (
                <div className="grid-2" key={index} style={{ marginBottom: 8 }}>
                  <label className="field"><span>开演前小时数（以上）</span><input type="number" value={tier.beforeHours} disabled={!editable} onChange={(event) => {
                    const fee_tiers = form.fee_tiers.slice();
                    fee_tiers[index] = { ...tier, beforeHours: Number(event.target.value) };
                    patch({ fee_tiers });
                  }} /></label>
                  <label className="field"><span>手续费 %</span><input type="number" value={tier.feePercent} disabled={!editable} onChange={(event) => {
                    const fee_tiers = form.fee_tiers.slice();
                    fee_tiers[index] = { ...tier, feePercent: Number(event.target.value) };
                    patch({ fee_tiers });
                  }} /></label>
                </div>
              ))}
              {editable && (
                <button type="button" className="btn small" onClick={() => patch({ fee_tiers: [...form.fee_tiers, { beforeHours: 0, feePercent: 0 }] })}>添加档位</button>
              )}
            </div>
            <Check label="允许改签（最多一次，不补差价）" on={!!form.reschedule} disabled={!editable} onClick={() => patch({ reschedule: form.reschedule ? 0 : 1 })} />
            <div className="check-row">
              {channels.map((channel) => {
                const on = form.reschedule_channels.includes(channel.id);
                return (
                  <button type="button" key={channel.id} disabled={!editable || !form.reschedule} className={`check ${on ? "on" : ""}`} onClick={() => patch({ reschedule_channels: on ? form.reschedule_channels.filter((id) => id !== channel.id) : [...form.reschedule_channels, channel.id] })}>
                    {channel.name}
                  </button>
                );
              })}
            </div>
            <Check label="改签需审核" on={!!form.reschedule_audit} disabled={!editable} onClick={() => patch({ reschedule_audit: form.reschedule_audit ? 0 : 1 })} />
            <RadioGroup label="周末改签" value={form.reschedule_weekend} options={["周末可改", "周末不可改"]} disabled={!editable} onChange={(value) => patch({ reschedule_weekend: value })} />
            <Check label="撤改需审核" on={!!form.change_audit} disabled={!editable} onClick={() => patch({ change_audit: form.change_audit ? 0 : 1 })} />
            <RadioGroup label="过期操作" value={form.expire_action} options={["不处理", "自动完结", "自动验证", "自动取消"]} disabled={!editable} onChange={(value) => patch({ expire_action: value })} />
          </div>
        )}

        {tab === "其他" && (
          <div className="stack">
            <label className="field" style={{ maxWidth: 240 }}>
              <span>人数（报表用，订单人数 = 票数 × 人数）</span>
              <input type="number" value={form.people_count} disabled={!editable} onChange={(event) => patch({ people_count: Number(event.target.value) })} />
            </label>
            <div className="grid-3">
              <label className="field"><span>特殊票种</span>
                <select value={form.special_type} disabled={!editable} onChange={(event) => patch({ special_type: event.target.value })}>
                  {["无", "老人票", "儿童票", "学生票"].map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="field"><span>性别限制</span>
                <select value={form.special_gender} disabled={!editable} onChange={(event) => patch({ special_gender: event.target.value })}>
                  {["不限", "男", "女"].map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="field"><span>区域限制</span><input value={form.special_region} disabled={!editable} onChange={(event) => patch({ special_region: event.target.value })} /></label>
            </div>
            <RadioGroup label="票状态" value={form.shelf_mode} options={["发布上架", "放入仓库", "上下架自动控制"]} disabled={!editable} onChange={(value) => patch({ shelf_mode: value })} />
            {form.shelf_mode === "上下架自动控制" && (
              <>
                <RadioGroup label="自动控制依据" value={form.shelf_trigger} options={["预订时间", "指定时间"]} disabled={!editable} onChange={(value) => patch({ shelf_trigger: value })} />
                {form.shelf_trigger === "指定时间" && (
                  <div className="grid-2">
                    <label className="field"><span>上架时间</span><input type="datetime-local" value={form.shelf_on} disabled={!editable} onChange={(event) => patch({ shelf_on: event.target.value })} /></label>
                    <label className="field"><span>下架时间</span><input type="datetime-local" value={form.shelf_off} disabled={!editable} onChange={(event) => patch({ shelf_off: event.target.value })} /></label>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>

      <div className="sticky-save">
        <span>{message ?? (editable ? "改完规则后保存。价格日历和渠道开关在旁边的页面。" : "当前角色只读。")}</span>
        <button className="btn primary" type="button" disabled={!editable || pending} onClick={onSave} style={{ color: ok ? "white" : undefined }}>
          {pending ? "保存中…" : "保存票类规则"}
        </button>
      </div>
    </div>
  );
}

function Check({ label, on, onClick, disabled }: { label: string; on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={`check ${on ? "on" : ""}`} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

function RadioGroup({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="hint">{label}</p>
      <div className="choice-row">
        {options.map((option) => (
          <label key={option} className={`choice ${value === option ? "on" : ""}`}>
            <input type="radio" checked={value === option} disabled={disabled} onChange={() => onChange(option)} />
            {option}
          </label>
        ))}
      </div>
    </div>
  );
}
