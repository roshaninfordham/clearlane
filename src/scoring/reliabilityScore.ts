export function speedScore(avgSpeedMph?: number): number {
  if (avgSpeedMph === undefined) return 35;
  if (avgSpeedMph < 5) return 100;
  if (avgSpeedMph < 7) return 85;
  if (avgSpeedMph < 9) return 65;
  if (avgSpeedMph < 11) return 40;
  return 20;
}

export function reliabilityConfidence(sampleSize?: number, hasGeometry = false): number {
  const sampleConfidence = sampleSize ? Math.min(0.45, sampleSize / 500) : 0.15;
  return Math.min(0.95, 0.35 + sampleConfidence + (hasGeometry ? 0.15 : 0));
}
