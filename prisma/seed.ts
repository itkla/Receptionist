import { PrismaClient, ShipmentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

// Helper function to generate a random 6-char uppercase ID
function generateShortId(length = 6): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

async function main() {
  console.log('Start seeding ...');

  // --- Seed Default Location ---
  console.log('Seeding Default Location...');
  const defaultLocation = await prisma.location.upsert({
      where: { name: 'Default Warehouse' }, // Use name as unique identifier for upsert
      update: {},
      create: {
          name: 'Default Warehouse',
          recipientEmails: ['warehouse@example.com'] // Add a default email
      }
  });
  console.log(`Upserted default location: ${defaultLocation.name} (ID: ${defaultLocation.id})`);

  // --- Seed API Keys ---
  console.log('Seeding API Keys...');
  const testApiKey = 'concierge_test_key_12345';
  const testApiKeyHash = await bcrypt.hash(testApiKey, SALT_ROUNDS);
  await prisma.apiKey.upsert({
      where: { keyHash: testApiKeyHash },
      update: {},
      create: {
          keyHash: testApiKeyHash,
          description: 'Concierge Test Key',
          isActive: true
      }
  });
  console.log(`Upserted test API Key (Plain text: ${testApiKey})`);

  // --- Seed Shipments ---
  console.log('Seeding Shipments and Devices...');

  // --- Populate shortId for existing shipments --- 
  console.log('Checking for shipments missing shortId...');
  const shipmentsToUpdate = await prisma.shipment.findMany({
    // @ts-ignore - Keep ignore for now, as Prisma might still warn depending on version/strictness
    where: { shortId: { equals: null } }, // Use standard Prisma filter syntax for null check
    select: { id: true }, // Only fetch IDs
  });

  if (shipmentsToUpdate.length > 0) {
    console.log(`Found ${shipmentsToUpdate.length} shipments to update with shortId.`);
    // Fetch all existing shortIds to ensure uniqueness
    const existingShortIds = new Set(
      (await prisma.shipment.findMany({
        // @ts-ignore - Temporarily ignore type error during backfill check
        where: { shortId: { not: null } },
        select: { shortId: true },
      })).map(s => s.shortId!)
    );

    for (const shipment of shipmentsToUpdate) {
      let newShortId: string;
      do {
        newShortId = generateShortId();
      } while (existingShortIds.has(newShortId)); // Ensure generated ID is unique

      await prisma.shipment.update({
        where: { id: shipment.id },
        data: { shortId: newShortId },
      });
      existingShortIds.add(newShortId); // Add newly generated ID to the set
      console.log(`Updated shipment ${shipment.id} with shortId: ${newShortId}`);
    }
    console.log('Finished updating shortIds.');
  } else {
    console.log('No shipments found needing a shortId.');
  }
  // --- End populate shortId ---

  // --- Keep existing seed shipment creation logic --- 
  // Ensure they now include a shortId during creation
  let seedShipment1ShortId = generateShortId();
  // Basic check (improve if collisions become likely)
  while ((await prisma.shipment.count({ where: { shortId: seedShipment1ShortId } })) > 0) {
      seedShipment1ShortId = generateShortId();
  }

  const seedShipment1 = await prisma.shipment.upsert({
    where: { id: 'seed-shipment-1' },
    update: { locationId: defaultLocation.id }, // Ensure it links to a location
    create: {
      id: 'seed-shipment-1',
      shortId: seedShipment1ShortId, // Add shortId here
      senderName: 'IT Seed Dept',
      senderEmail: 'it@seed.example.com',
      status: ShipmentStatus.PENDING,
      locationId: defaultLocation.id,
      devices: {
        create: [
          { serialNumber: 'SEED-SN-001', assetTag: 'SEED-AT-001', model: 'iPad Seed Gen 1' },
          { serialNumber: 'SEED-SN-002', assetTag: 'SEED-AT-002', model: 'iPad Seed Gen 1' },
        ],
      },
    },
    include: { devices: true }, // Include devices to log
  });
  console.log(`Upserted shipment ${seedShipment1.shortId} (${seedShipment1.id}) with ${seedShipment1.devices.length} devices for location ${defaultLocation.name}`);

  // Shipment 2: Needs shortId population if null (redundant if run after update block, but safe)
  let seedShipment2ShortId: string | undefined;
  const existingShipment2 = await prisma.shipment.findUnique({ 
    where: { id: 'seed-shipment-2' },
    select: { shortId: true }
  });

  if (existingShipment2 && !existingShipment2.shortId) {
    console.log('Shipment seed-shipment-2 needs shortId, generating...');
    const existingShortIds = new Set(
      (await prisma.shipment.findMany({
        // @ts-ignore - Temporarily ignore type error during backfill check
        where: { shortId: { not: null } },
        select: { shortId: true },
      })).map(s => s.shortId!)
    );
    do {
      seedShipment2ShortId = generateShortId();
    } while (existingShortIds.has(seedShipment2ShortId));
  } else if (existingShipment2?.shortId) {
    seedShipment2ShortId = existingShipment2.shortId;
    console.log(`Shipment seed-shipment-2 already has shortId: ${seedShipment2ShortId}`);
  } else {
    // Doesn't exist yet, generate a new one
    console.log('Generating new shortId for seed-shipment-2...')
    const existingShortIds = new Set(
      (await prisma.shipment.findMany({
        // @ts-ignore - Temporarily ignore type error during backfill check
        where: { shortId: { not: null } },
        select: { shortId: true },
      })).map(s => s.shortId!)
    );
     do {
      seedShipment2ShortId = generateShortId();
    } while (existingShortIds.has(seedShipment2ShortId));
  }
  
  if (!seedShipment2ShortId) { 
    throw new Error("Failed to generate shortId for seed-shipment-2");
  }

  const completedShipment = await prisma.shipment.upsert({
      where: { id: 'seed-shipment-2' },
      // Update block: update fields BUT NOT devices (let create handle devices)
      update: {
        status: ShipmentStatus.COMPLETED, // Set final status here if updating
        recipientName: 'Bob Receiver',
        recipientSignature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==',
        receivedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        locationId: defaultLocation.id, 
        shortId: seedShipment2ShortId, 
      },
      // Create block: define the full record including devices
      create: {
        id: 'seed-shipment-2',
        shortId: seedShipment2ShortId, 
        senderName: 'IT Seed Dept 2',
        senderEmail: 'it2@seed.example.com',
        // Set final status here if creating as completed
        status: ShipmentStatus.COMPLETED, 
        recipientName: 'Bob Receiver',
        recipientSignature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==',
        receivedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        locationId: defaultLocation.id, // Link location via ID
        // Add devices directly here
        devices: {
            create: [
                {
                    serialNumber: 'SEED-SN-003',
                    assetTag: 'SEED-AT-003',
                    model: 'iPad Seed Gen 2',
                    isCheckedIn: true, // Mark as checked in
                    checkedInAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Set check-in time
                },
                {
                    serialNumber: 'SEED-SN-004',
                    assetTag: 'SEED-AT-004',
                    model: 'iPad Seed Gen 2',
                    isCheckedIn: true, // Mark as checked in
                    checkedInAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Set check-in time
                }
            ]
        }
      },
      // Include devices to ensure they are available if needed later
      include: { devices: true } 
  });
  console.log(`Upserted completedShipment ${completedShipment.shortId} (${completedShipment.id}) with ${completedShipment.devices.length} devices.`);

  // --- Seed Admin User ---
  console.log('Seeding Admin User...');
  const adminEmail = 'admin@example.com';
  const adminPassword = 'password123';

  // Hash the password
  const hashedPassword = await bcrypt.hash(adminPassword, SALT_ROUNDS);
  console.log(`Hashed password for ${adminEmail}`);

  // Create or update the admin user
  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
        password: hashedPassword,
    },
    create: {
      email: adminEmail,
      password: hashedPassword,
      name: 'Admin User',
    },
  });

  console.log(`Created/updated admin user with email: ${user.email}`);

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 