import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const SETTING_KEY = "adminNotifyEmails";

// GET handler to fetch email settings
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // console.log("Prisma client object keys:", Object.keys(prisma || {}));
        const setting = await prisma.setting.findUnique({
            where: { key: SETTING_KEY },
        });

        if (!setting) {
            // Return 404 if the setting hasn't been created yet
            return NextResponse.json({ error: 'Setting not found' }, { status: 404 });
        }

        return NextResponse.json({ key: setting.key, value: setting.value });

    } catch (error: any) {
        console.error("Error fetching email settings:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// PUT handler to update email settings
export async function PUT(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { adminNotifyEmails } = body;

        // Basic validation
        if (typeof adminNotifyEmails !== 'string') {
            return NextResponse.json({ error: 'Invalid input data: adminNotifyEmails must be a string.' }, { status: 400 });
        }

        // Validate individual emails
        const emails = adminNotifyEmails.split(',').map(e => e.trim()).filter(e => e);
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        for (const email of emails) {
            if (!emailRegex.test(email)) {
                return NextResponse.json({ error: `Invalid email format: ${email}` }, { status: 400 });
            }
        }
        const validatedEmailString = emails.join(','); // Use cleaned up list

        // Upsert the setting into the database
        const settingKey = SETTING_KEY;
        await prisma.setting.upsert({
            where: { key: settingKey },
            update: { value: validatedEmailString },
            create: { key: settingKey, value: validatedEmailString },
        });

        console.log(`Admin notification emails updated by user ${session.user.email || session.user.id}`);
        return NextResponse.json({ success: true, message: 'Email settings saved.' });

    } catch (error: any) {
        console.error("Error saving email settings:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
 