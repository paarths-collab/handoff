export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Envelope detection only. parsePack validates the complete library before use. */
export function isPackEnvelope(value: unknown): value is {format: 'tab-mover-pack'; schemaVersion: 1; createdAt: string; library: unknown} {
  return isRecord(value) && value.format === 'tab-mover-pack' && value.schemaVersion === 1 &&
    typeof value.createdAt === 'string' && isRecord(value.library);
}
