import request, { type RequestDocument } from "graphql-request";

export async function tayaswapSubpgrah(query: RequestDocument, variables = {}) {
    if (!process.env.GRAPHQL_ENDPOINT) {
        throw new Error("GRAPHQL_ENDPOINT is not set");
    }
    return await request(process.env.GRAPHQL_ENDPOINT, query, variables);
}

export const POOLS_CACHE_KEY = "pools";

export const POOLS_CACHE = 300; // 5 minutes
