import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.match.deleteMany({
    where: {
      sofaId: {
        lt: 1000 // Fake matches had IDs 10 and 42
      }
    }
  });
  console.log(`Deleted ${result.count} fake matches from the database.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
