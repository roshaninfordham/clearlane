import { execFileSync } from "node:child_process";

for (const [command, args] of [
  ["npm", ["run", "typecheck"]],
  ["npm", ["run", "lint"]],
  ["npm", ["test"]],
  ["npm", ["run", "build"]],
  ["npm", ["run", "pack:dry"]],
  ["npm", ["run", "publish:dry"]]
] as const) {
  console.log(`$ ${command} ${args.join(" ")}`);
  execFileSync(command, args, { stdio: "inherit" });
}
