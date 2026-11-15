import { decodeJwt } from "jose";
import { assinarToken } from "../../src/services/auth.service.ts";
import { prisma } from "../../src/db.ts";

const { exp, iat } = decodeJwt(await assinarToken(1, "operador"));
process.stdout.write(`${(exp ?? 0) - (iat ?? 0)}\n`);
await prisma.$disconnect();
