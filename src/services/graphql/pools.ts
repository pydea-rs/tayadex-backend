import type { AppContext } from "@/types";
import { GET_POOLS_QUERY } from "./queries";
import { POOLS_CACHE, POOLS_CACHE_KEY, tayaswapSubpgrah } from "./constants";
import { IPairTokenData } from "./common";
import { CacheService } from "../cache";

interface IPoolsResponse {
  pairs: IPairTokenData[];
}

async function fetchPools() {
  const { pairs } = (await tayaswapSubpgrah(
    GET_POOLS_QUERY,
    {}
  )) as IPoolsResponse;

  return pairs;
}

export async function getPools(context: AppContext): Promise<IPairTokenData[]> {
  const cachedPools = CacheService.getInstance().get(POOLS_CACHE_KEY);

  const pools = cachedPools ? JSON.parse(cachedPools) : await fetchPools();

  if (!cachedPools) {
    CacheService.getInstance().put(POOLS_CACHE_KEY, JSON.stringify(pools), {
      expirationTtl: POOLS_CACHE,
    });
  }

  return pools;
}
