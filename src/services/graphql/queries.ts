import { gql } from "graphql-request";

export const GET_POOLS_QUERY = gql`
  query GetPools {
    pairs(orderBy: volumeUSD, orderDirection: desc) {
      id
      reserve0
      reserve1
      token0 {
        decimals
        id
        name
        symbol
      }
      token1 {
        id
        name
        symbol
        decimals
      }
      totalSupply
      volumeUSD
      reserveUSD
    }
  }
`;

export const GET_SHMON_SWAPS = gql`
  query info($address: Bytes) {
    pair(id: "0x87a315b0260ebf7f84560b2fb4b427b170e6cd36") {
      swaps(where: { from: $address }) {
        amount0In
        amount0Out
      }
    }
  }
`;

export const GET_USER_SWAPS = gql`
  query UserSwaps($address: Bytes) {
    swaps(where: { from: $address }) {
      id
      pair {
        id
        token0 {
          symbol
        }
        token1 {
          symbol
        }
      }
      amount0In
      amount0Out
      amount1In
      amount1Out
      timestamp
    }
  }
`;

export const GET_USER_LIQUIDITY = gql`
  query UserLiquidity($address: Bytes) {
    mints(where: { to: $address }) {
      id
      pair {
        id
        token0 {
          symbol
        }
        token1 {
          symbol
        }
      }
      amount0
      amount1
      timestamp
    }
    burns(where: { sender: $address }) {
      id
      pair {
        id
        token0 {
          symbol
        }
        token1 {
          symbol
        }
      }
      amount0
      amount1
      timestamp
    }
  }
`;

export const GET_NEW_SWAPS = gql`
  query NewSwaps($lastBlock: BigInt!) {
    swaps(
      first: 1000
      orderBy: blockNumber
      orderDirection: asc
      where: { blockNumber_gt: $lastBlock }
    ) {
      id
      from
      to
      amount0In
      amount1In
      amount0Out
      amount1Out
      blockNumber
      timestamp
      transaction {
        id
      }
      pair {
        id
        token0 {
          symbol
          decimals
        }
        token1 {
          symbol
          decimals
        }
      }
    }
  }
`;

export const GET_NEW_LIQUIDITY = gql`
  query NewLiquidity($lastBlock: BigInt!) {
    mints(
      first: 1000
      orderBy: blockNumber
      orderDirection: asc
      where: { blockNumber_gte: $lastBlock }
    ) {
      id
      sender
      to
      amount0
      amount1
      blockNumber
      timestamp
      transaction {
        id
      }
      pair {
        id
        token0 {
          symbol
          decimals
        }
        token1 {
          symbol
          decimals
        }
      }
    }
    burns(
      first: 1000
      orderBy: blockNumber
      orderDirection: asc
      where: { blockNumber_gte: $lastBlock }
    ) {
      id
      sender
      to
      amount0
      amount1
      blockNumber
      timestamp
      transaction {
        id
      }
      pair {
        id
        token0 {
          symbol
          decimals
        }
        token1 {
          symbol
          decimals
        }
      }
    }
  }
`;
