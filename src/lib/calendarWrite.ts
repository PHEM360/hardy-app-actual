/** Firestore rejects undefined fields. Empty optional form values must be omitted. */
export function calendarWriteData<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T;
}
