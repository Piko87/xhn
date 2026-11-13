export function yuan(value: number) {
  return `¥${Number(value || 0).toLocaleString("zh-CN")}`;
}

export function stockLabel(value: number) {
  return value < 0 ? "不限" : String(value);
}

export function statusTone(status: string) {
  if (["未使用", "正常", "同意", "开售", "已支付", "启用", "充足", "可写"].includes(status)) return "ok";
  if (["等待审核", "待确认", "部分使用", "紧张", "少量", "自动控制·下架", "只读"].includes(status)) return "warn";
  if (["被取消", "拒绝", "售罄", "停用", "停售", "仓库"].includes(status)) return "danger";
  return "mute";
}
