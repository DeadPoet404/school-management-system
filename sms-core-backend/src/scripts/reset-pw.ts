/* eslint-disable no-console */
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

const email = process.argv[2];
const pw = process.argv[3];

if (!email) {
  console.error('Usage: npx tsx src/scripts/reset-pw.ts <email> <password>');
  process.exit(1);
}
if (!pw) {
  console.error('Error: Password is required. Refusing to use a default for security reasons.');
  console.error('Usage: npx tsx src/scripts/reset-pw.ts <email> <password>');
  process.exit(1);
}

async function run() {
  const hash = await bcrypt.hash(pw!, 10);
  let r = await prisma.staffAccount.updateMany({ where: { email }, data: { passwordHash: hash } });
  if (r.count) return console.log(`Staff ${email} -> ${pw}`);
  r = await prisma.teacherAccount.updateMany({ where: { email }, data: { passwordHash: hash } });
  if (r.count) return console.log(`Teacher ${email} -> ${pw}`);
  r = await prisma.studentAccount.updateMany({ where: { portalEmail: email }, data: { passwordHash: hash } });
  if (r.count) return console.log(`Student ${email} -> ${pw}`);
  console.log('Not found');
}

run().finally(() => prisma.$disconnect());
