import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

type PackEntry = { files?: Array<{ path: string }> };

const errors: string[] = [];
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
  name?: string;
  version?: string;
  files?: string[];
};
const readme = existsSync("README.md") ? readFileSync("README.md", "utf8") : "";

if (!pkg.name || pkg.name.includes("YOUR_NPM_SCOPE")) errors.push("Package name still contains YOUR_NPM_SCOPE.");
if (!pkg.version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(pkg.version)) {
  errors.push("Package version is not valid semver.");
}
if (!pkg.files || !pkg.files.includes("dist")) errors.push("Package files list is missing dist.");
if (!existsSync("dist")) errors.push("dist does not exist. Run npm run build.");
if (/TODO|YOUR_NPM_SCOPE/.test(readme)) errors.push("README still contains TODO placeholders.");

try {
  const raw = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  const entries = JSON.parse(raw) as PackEntry[];
  const files = entries.flatMap((entry) => entry.files ?? []).map((file) => file.path);
  const forbidden = files.filter(
    (file) =>
      file === ".env" ||
      file.startsWith("input/") ||
      file.startsWith("output/") ||
      file.includes(".clearlane/cache") ||
      /\.(mp4|mov|avi|mkv|log)$/i.test(file)
  );
  if (forbidden.length > 0) errors.push(`Forbidden files would be packed: ${forbidden.join(", ")}`);
} catch (error) {
  errors.push(`Unable to inspect npm pack output: ${String(error)}`);
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("Prepublish check passed.");
