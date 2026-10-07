type PageResult<T> = { data: T[] | null; error: { message: string; code?: string } | null };

/** Read beyond the API row cap without presenting an incomplete report. */
export async function readAllSupabaseRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<PageResult<T>> {
  const pageSize = 500;
  const data: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    if (page.error) return { data: null, error: page.error };
    const rows = page.data ?? [];
    data.push(...rows);
    if (rows.length < pageSize) return { data, error: null };
  }
}

/** Keep parent-ID filters below URL limits while reading every matching child row. */
export async function readAllSupabaseRowsForIds<T>(
  ids: string[],
  fetchPage: (ids: string[], from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<PageResult<T>> {
  const uniqueIds = [...new Set(ids)];
  const data: T[] = [];
  for (let start = 0; start < uniqueIds.length; start += 100) {
    const batch = uniqueIds.slice(start, start + 100);
    const result = await readAllSupabaseRows<T>((from, to) => fetchPage(batch, from, to));
    if (result.error) return { data: null, error: result.error };
    data.push(...(result.data ?? []));
  }
  return { data, error: null };
}
