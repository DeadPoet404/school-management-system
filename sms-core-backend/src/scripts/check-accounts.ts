/* eslint-disable no-console */
import { prisma } from '@/lib/prisma';
async function run() {
  const staff = await prisma.staffAccount.findMany({ select: { email: true }, take: 5 });
  const teachers = await prisma.teacherAccount.findMany({ select: { email: true }, take: 5 });
  const students = await prisma.studentAccount.findMany({ select: { portalEmail: true }, take: 5 });
  console.log('Staff:', staff.length, staff.map(s => s.email));
  console.log('Teachers:', teachers.length, teachers.map(t => t.email));
  console.log('Students:', students.length, students.map(s => s.portalEmail));
  console.log('Staff total:', await prisma.staffAccount.count());
  console.log('Teacher total:', await prisma.teacherAccount.count());
  console.log('Student total:', await prisma.studentAccount.count());
}
run().finally(() => prisma.$disconnect());
