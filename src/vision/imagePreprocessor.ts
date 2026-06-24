import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export async function preprocessImage(inputPath: string, outputPath: string): Promise<string> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  try {
    await sharp(inputPath)
      .rotate()
      .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toFile(outputPath);
    return outputPath;
  } catch {
    await copyFile(inputPath, outputPath);
    return outputPath;
  }
}
