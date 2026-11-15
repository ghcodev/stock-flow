import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";
import { config } from "./config.ts";

const adapter = new PrismaPg({ connectionString: config.databaseUrl, max: 10 });

export const prisma = new PrismaClient({ adapter });
