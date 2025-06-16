// prisma.ts
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();

// TODO: Doesn't this need $connect & disconnect calls?