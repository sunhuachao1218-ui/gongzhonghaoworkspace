export function adjacentCoverSample(samples, currentId, direction) {
  if (!Array.isArray(samples) || samples.length === 0) return null;
  const index = samples.findIndex((sample) => sample.id === currentId);
  if (index === -1) return null;
  return samples[(index + direction + samples.length) % samples.length];
}
