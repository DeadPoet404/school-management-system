import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function fix() {
  await prisma.student.updateMany({
    where: { status: "DEPARTED" },
    data: { status: "ACTIVE" }
  });
  console.log("✅ All students reset to ACTIVE");
  await prisma.$disconnect();
}

fix();