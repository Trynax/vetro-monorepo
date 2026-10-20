import * as graphql from "./graphql.ts";

const defaultPageSize = 100;
// graph-node rejects a `skip` greater than 5000, so we can never page past that
// with `skip` alone. Once we reach it, callers that provide a `cursor` advance a
// `$where` lower bound instead and reset `skip` to 0.
// https://github.com/graphprotocol/graph-node/issues/1309
const defaultMaxSkip = 5000;

type Cursor<R> = {
  // Stable, unique id for a row, used to drop the boundary rows that are
  // re-read after a reset (the lower bound is inclusive, `_gte`). Defaults to
  // the stringified `getValue`, which is enough when the ordered value is unique.
  getId?: (row: R) => string;
  // The value the query orders by (ascending). On reset the query's lower-bound
  // variable is set to the last row's value so paging continues from there.
  getValue: (row: R) => number | string;
  // Name of the `$where` lower-bound variable to advance (e.g. "start"). The
  // query must filter `<orderedField>_gte: $<variable>` and order by it ascending.
  variable: string;
};

// Append a page's rows to `all`. Without dedup (no cursor) it is a plain
// concat; with a cursor it drops rows already collected, since the inclusive
// `_gte` lower bound re-reads boundary rows after a reset.
function collectNewRows<R>({
  all,
  getId,
  rows,
  seen,
}: {
  all: R[];
  getId: ((row: R) => string) | undefined;
  rows: R[];
  seen: Set<string> | undefined;
}) {
  if (!getId || !seen) {
    all.push(...rows);
    return;
  }
  for (const row of rows) {
    const id = getId(row);
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    all.push(row);
  }
}

// Resolve the query's next `$where` lower bound once `skip` has hit the cap, or
// throw when paging cannot continue (no cursor, or the value cannot advance).
function resolveNextBound<R>({
  cursor,
  field,
  lastRow,
  maxSkip,
  pageVariables,
}: {
  cursor: Cursor<R> | undefined;
  field: string;
  lastRow: R;
  maxSkip: number;
  pageVariables: Record<string, unknown>;
}) {
  if (!cursor) {
    throw new Error(
      `Subgraph pagination for ${field} exceeded the maximum page offset (${maxSkip}); provide a cursor to paginate further`,
    );
  }
  const value = cursor.getValue(lastRow);
  if (value === pageVariables[cursor.variable]) {
    throw new Error(
      `Subgraph pagination for ${field} cannot advance past cursor ${String(value)}; too many rows share this value`,
    );
  }
  return { value, variable: cursor.variable };
}

/**
 * Run a paginated subgraph query, accumulating every page into a single array.
 *
 * The `query` must declare `$first: Int!` and `$skip: Int!` and select a single
 * top-level field whose name matches `field`. Pages are fetched until a short
 * (less-than-`pageSize`) page is returned.
 *
 * graph-node caps `skip` at `maxSkip` (5000). To page beyond that, pass a
 * `cursor`: when `skip` would exceed the cap, the query's lower-bound variable
 * is advanced to the last row's value and `skip` resets to 0, with boundary rows
 * deduped by `cursor.getId`. Without a `cursor`, hitting the cap throws rather
 * than letting the subgraph fail or silently truncate.
 */
export async function paginateSubgraphQuery<R>({
  cursor,
  field,
  maxSkip = defaultMaxSkip,
  pageSize = defaultPageSize,
  query,
  url,
  variables = {},
}: {
  cursor?: Cursor<R>;
  field: string;
  maxSkip?: number;
  pageSize?: number;
  query: string;
  url: string;
  variables?: Record<string, unknown>;
}): Promise<R[]> {
  const all: R[] = [];
  const getId = cursor
    ? (cursor.getId ?? ((row: R) => String(cursor.getValue(row))))
    : undefined;
  const seen = cursor ? new Set<string>() : undefined;
  let pageVariables = { ...variables };
  let skip = 0;
  let done = false;

  while (!done) {
    const data = await graphql.runQuery<Record<string, R[]>>({
      query,
      url,
      variables: { ...pageVariables, first: pageSize, skip },
    });
    const rows = data[field];
    if (!Array.isArray(rows)) {
      throw new Error(`Invalid subgraph response for ${field}`);
    }

    collectNewRows({ all, getId, rows, seen });

    if (rows.length < pageSize) {
      done = true;
      continue;
    }

    skip += pageSize;
    if (skip > maxSkip) {
      const { value, variable } = resolveNextBound({
        cursor,
        field,
        lastRow: rows[rows.length - 1],
        maxSkip,
        pageVariables,
      });
      pageVariables = { ...pageVariables, [variable]: value };
      skip = 0;
    }
  }

  return all;
}
