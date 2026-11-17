import { spawn } from "node:child_process";

const extra = "--experimental-sqlite";
const current = process.env.NODE_OPTIONS || "";
const env = { ...process.env, NODE_OPTIONS: `${current} ${extra}`.trim() };
const [command, ...args] = process.argv.slice(2);
const child = spawn(command, args, { stdio: "inherit", env, shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
