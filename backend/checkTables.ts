import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
  console.log('Tables in public schema:', tables);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
