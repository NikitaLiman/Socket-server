import { prisma } from "./prisma-client";

async function Up() {
  await prisma.user.createMany({
    data: [
      {
        fullname: "Nikita",
        email: "Nikita@gmail.com",
        password: "nikita",
        verified: new Date(),
        role: "USER",
      },
      {
        fullname: "Oleg",
        email: "Oleg@gmail.com",
        password: "oleg",
        verified: new Date(),
        role: "USER",
      },
    ],
  });
}
async function Down() {
  await prisma.$executeRaw`TRUNCATE TABLE "User" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "Chat" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "ChatUser" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "Message" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "SavedChat" RESTART IDENTITY CASCADE`;
}

async function main() {
  try {
    await Down();
    await Up();
  } catch (error) {
    console.log(error);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
