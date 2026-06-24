import { mkdir } from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";

export async function ffmpegAvailable(): Promise<boolean> {
  try {
    await execa("ffmpeg", ["-version"], { stdout: "ignore", stderr: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export async function extractFrames(videoPath: string, outDir: string, maxFrames = 2): Promise<string[]> {
  if (!(await ffmpegAvailable())) return [];
  await mkdir(outDir, { recursive: true });
  const pattern = path.join(outDir, "frame-%03d.jpg");
  try {
    await execa("ffmpeg", [
      "-y",
      "-i",
      videoPath,
      "-vf",
      `fps=1/${Math.max(1, Math.floor(10 / maxFrames))}`,
      "-frames:v",
      String(maxFrames),
      pattern
    ]);
    return Array.from({ length: maxFrames }, (_, index) => path.join(outDir, `frame-${String(index + 1).padStart(3, "0")}.jpg`));
  } catch {
    return [];
  }
}
