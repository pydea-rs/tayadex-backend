import type { TokensNumericalData } from "@/utils";
import type { TransactionType } from "@prisma/client";
import type { InputJsonValue } from "@prisma/client/runtime/library";

export type TransactionProcessorPayloadType = {
    txHash: string;
    eventType: string | TransactionType;
    blockNumber: bigint;
    tokensData: TokensNumericalData[];
    to: string;
    metadata?: InputJsonValue;
};

export type TransactionQueueElement = {
    payload: TransactionProcessorPayloadType;
    retries: number;
};
