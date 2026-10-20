export function theGraphUrl({
  apiKey,
  subgraphId,
}: {
  apiKey: string | undefined;
  subgraphId: string;
}) {
  if (!apiKey) {
    throw new Error("SUBGRAPH_API_KEY must be set");
  }
  return `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${subgraphId}`;
}

export function getSubgraphUrl(env: Env): string {
  if (env.SUBGRAPH_URL) {
    return env.SUBGRAPH_URL;
  }
  if (!env.SUBGRAPH_ID) {
    throw new Error("SUBGRAPH_ID must be set");
  }
  return theGraphUrl({
    apiKey: env.SUBGRAPH_API_KEY,
    subgraphId: env.SUBGRAPH_ID,
  });
}
