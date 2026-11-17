import { rmSync } from "node:fs";

for (const file of ["data/xhn.sqlite", "data/xhn.sqlite-shm", "data/xhn.sqlite-wal"]) {
  rmSync(file, { force: true });
}
console.log("已删除本地演示库。下次启动会重新生成。");
