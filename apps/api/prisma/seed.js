const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  // Check if any user exists
  const userCount = await prisma.user.count();

  if (userCount === 0) {
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || '123456';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash,
        isSuperAdmin: true,
        status: 'active',
      },
    });

    console.log(`Default admin user created. Username: admin, Password: ${defaultPassword}`);
  } else {
    console.log('Database already has users. Skipping admin creation.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
