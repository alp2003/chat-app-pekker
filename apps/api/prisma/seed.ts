import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'Alex',
      passwordHash: 'hashed',
    },
  });

  const room = await prisma.room.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'General',
      isGroup: true,
    },
  });

  await prisma.membership.upsert({
    where: { userId_roomId: { userId: user.id, roomId: room.id } },
    update: {},
    create: { userId: user.id, roomId: room.id, role: 'member' },
  });
}

main().finally(() => prisma.$disconnect());
