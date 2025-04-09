import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import minimist from 'minimist'; // For parsing command-line arguments

const prisma = new PrismaClient();
const SALT_ROUNDS = 10; // Use the same salt rounds as your seed/app

async function addAdminUser(email?: string, password?: string) {
  if (!email || !password) {
    console.error('Error: Email and password are required.');
    console.log('Usage: ts-node cli.ts --email <email> --password <password> [--name <name>]');
    process.exit(1);
  }

  console.log(`Attempting to add admin user: ${email}`);

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.warn(`User with email ${email} already exists. Aborting.`);
      return; // Don't throw error, just warn and exit gracefully
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    console.log(`Password hashed successfully.`);

    // Create the user
    const newUser = await prisma.user.create({
      data: {
        email: email,
        password: hashedPassword,
        name: argv.name || 'Admin User', // Optional name argument, defaults to 'Admin User'
      },
    });

    console.log(`Successfully created admin user:`);
    console.log(`  ID:    ${newUser.id}`);
    console.log(`  Email: ${newUser.email}`);
    console.log(`  Name:  ${newUser.name || '(Not Set)'}`);

  } catch (error) {
    console.error('Error adding admin user:', error);
    process.exitCode = 1; // Indicate failure
  } finally {
    await prisma.$disconnect();
    console.log('Disconnected from database.');
  }
}

// --- Script Execution ---

// Parse command line arguments
// Example: ts-node cli.ts --email admin@example.com --password secret123 --name "Admin"
const argv = minimist(process.argv.slice(2));

// Extract email and password from arguments
const emailArg = argv.email as string | undefined;
const passwordArg = argv.password as string | undefined;

// Call the main function
addAdminUser(emailArg, passwordArg).catch(e => {
  // Catch any unhandled promise rejections from the async function itself
  console.error("Unhandled error during script execution:", e);
  process.exit(1);
});
