import { gql } from 'graphql-request'

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
`

export const GET_SHMON_SWAPS = gql`
    query info($address: Bytes) {
        pair(id: "0x87a315b0260ebf7f84560b2fb4b427b170e6cd36") {
                swaps(where: {from: $address}) {
                amount0In
                amount0Out
            }
        }
    }
`
