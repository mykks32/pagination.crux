/**
 * Applies a sparse fieldset (`?include=`/`?exclude=`) to a plain response
 * object. Operates on the already-serialized response DTO, not the
 * database projection — the sort/cursor fields must always be fetched
 * from the database regardless of what the client chooses to see, or
 * cursor encoding would silently break.
 */
export function applyFieldSelection<T extends { id: string }>(item: T, include?: string[], exclude?: string[]): Partial<T> {
  if (include && include.length > 0) {
    const picked = { id: item.id } as Partial<T>;
    for (const field of include) {
      if (field in item) picked[field as keyof T] = item[field as keyof T];
    }
    return picked;
  }

  if (exclude && exclude.length > 0) {
    const copy: Partial<T> = { ...item };
    for (const field of exclude) {
      if (field === 'id') continue; // id is never droppable — it's how a client re-identifies the row
      delete copy[field as keyof T];
    }
    return copy;
  }

  return item;
}
