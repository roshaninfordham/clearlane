import { ComplaintHotspot } from "../api/nycOpenDataClient.js";

export function complaintScore(hotspots: ComplaintHotspot[]): number {
  const total = hotspots.reduce((sum, hotspot) => sum + hotspot.count, 0);
  return Math.min(100, total * 2.2);
}
