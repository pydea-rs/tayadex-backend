// eslint-disable-next-line @typescript-eslint/no-var-requires
import {
    PointSystemRuleType,
    PrismaClient,
    ReferralCriteriaModes,
    ReferralRewardType,
    TransactionType,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    // 1 INSERT CHAIN DATA
    try {
        await Promise.all(
            [
                {
                    id: 10143,
                    name: "Monad Testnet",
                    providerUrl: "https://testnet-rpc.monad.xyz",
                    blockProcessRange: 50,
                    acceptedBlockStatus: "latest",
                },
            ].map(async ({ id, name, providerUrl }) =>
                prisma.chain.create({
                    data: {
                        id,
                        rpc: providerUrl,
                        lastIndexedBlock: 5253609n,
                        name,
                    },
                })
            )
        );
        console.info("Chain data inserted.");
    } catch (ex) {
        console.error("Failed importing chain data:", ex);
    }

    // 2 Insert PointRules data

    try {
        await prisma.pointSystemRule.create({
            data: {
                transactionType: TransactionType.SWAP,
                baseValue: 1,
                relativeValue: 0.05,
                type: PointSystemRuleType.GENERAL,
            },
        });

        await prisma.pointSystemRule.create({
            data: {
                transactionType: TransactionType.MINT,
                baseValue: 2,
                relativeValue: 0.1,
                type: PointSystemRuleType.GENERAL,
            },
        });

        await prisma.pointSystemRule.create({
            data: {
                transactionType: TransactionType.BURN,
                baseValue: -5,
                relativeValue: 0.05,
                type: PointSystemRuleType.GENERAL,
            },
        });
        console.info("PointSystemRules added.");
    } catch (ex) {
        console.error("Failed creating & importing point system rules.", ex);
    }

    // Insert Referral Rules data.
    try {
        await prisma.referralRules.create({
            data: {
                activisionReward: 100,
                activisionRewardType: ReferralRewardType.POINT,
                criteria: ReferralCriteriaModes.POINTS,
                devidByLayer: false,
                directRewardRatio: 0.1,
                directRewardType: ReferralRewardType.POINT,
                indirectRewardRatio: 0.01,
                indirectRewardType: ReferralRewardType.POINT,
            },
        });
        console.info("Referral rules inserted.");
    } catch (ex) {
        console.error("Failed importing contracts:", ex);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
