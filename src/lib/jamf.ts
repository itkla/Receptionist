/**
 * Mock Jamf Pro API interactions for device locking/unlocking.
 * Replace with actual API calls using fetch or a library.
 * 
 * Requires .env variables: JAMF_URL, JAMF_USER, JAMF_PASSWORD
 */

import https from 'https';

const jamfUrl = process.env.JAMF_URL;
const jamfUser = process.env.JAMF_USER;
const jamfPassword = process.env.JAMF_PASSWORD;

// Basic Auth Header
const authHeader = `Basic ${Buffer.from(`${jamfUser}:${jamfPassword}`).toString('base64')}`;

interface JamfDevice {
    general: {
        id: number;
        name: string;
        serial_number: string;
    };
    location: {
        username: string | null;
    };
}

// Helper to make Jamf API requests
async function jamfApiRequest(endpoint: string, method: string = 'GET', body: any = null): Promise<any> {
    if (!jamfUrl || !jamfUser || !jamfPassword) {
        throw new Error('Jamf API credentials or URL are not configured in environment variables.');
    }

    const url = `${jamfUrl.replace(/\/$/, '')}/JSSResource${endpoint}`;
    const options: https.RequestOptions = {
        method: method,
        headers: {
            'Authorization': authHeader,
            'Accept': 'application/json',
            ...(body && { 'Content-Type': 'application/xml' }), // Jamf often uses XML for PUT/POST
        },
        // Handle self-signed certs if needed (NOT recommended for production)
        // rejectUnauthorized: false, 
    };

    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                    reject(new Error(`Jamf API request failed: ${res.statusCode} ${res.statusMessage} - ${data}`));
                } else {
                    try {
                        // Handle empty responses for actions like DELETE or some PUTs
                        if (data.length === 0) {
                            resolve({ success: true, statusCode: res.statusCode });
                        } else {
                            resolve(JSON.parse(data));
                        }
                    } catch (parseError) {
                        // If JSON parsing fails but status code is success, it might be XML or empty
                        // Resolve successfully for actions, otherwise reject.
                         if (method !== 'GET') {
                            resolve({ success: true, statusCode: res.statusCode, raw: data });
                         } else {
                            reject(new Error(`Failed to parse Jamf API response: ${parseError} - Data: ${data}`));
                         }
                    }
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`Jamf API request error: ${error.message}`));
        });

        if (body && (method === 'POST' || method === 'PUT')) {
            req.write(body);
        }
        req.end();
    });
}

// Find Jamf device ID by serial number
async function findJamfDeviceIdBySerial(serialNumber: string): Promise<number | null> {
    try {
        // Note: Searching requires exact match with Jamf Classic API
        const response = await jamfApiRequest(`/mobiledevices/serialnumber/${serialNumber}`, 'GET');
        if (response?.mobile_device?.general?.id) {
            return response.mobile_device.general.id;
        }
        // Try computers if not found in mobile devices
        const computerResponse = await jamfApiRequest(`/computers/serialnumber/${serialNumber}`, 'GET');
         if (computerResponse?.computer?.general?.id) {
            return computerResponse.computer.general.id;
         }
       
        console.warn(`Jamf device not found for serial: ${serialNumber}`);
        return null;
    } catch (error: any) {
         // Handle 404 specifically if needed, otherwise log the error
         if (error.message?.includes('404')) {
            console.warn(`Jamf device not found for serial (404): ${serialNumber}`);
         } else {
            console.error(`Error finding Jamf device for serial ${serialNumber}:`, error);
         }
        return null;
    }
}

// Enable Lost Mode (Requires device ID)
export async function lockDevice(serialNumber: string): Promise<void> {
    console.log(`Attempting to lock device with serial: ${serialNumber}`);
    const deviceId = await findJamfDeviceIdBySerial(serialNumber);
    if (!deviceId) {
        console.error(`Cannot lock device: Jamf ID not found for serial ${serialNumber}`);
        return; // Or throw error if blocking is desired
    }

    // TODO: Customize the Lost Mode message/options as needed
    const lockCommandXml = `<mobile_device_command><general><command>EnableLostMode</command></general><mobile_devices><mobile_device><id>${deviceId}</id></mobile_device></mobile_devices></mobile_device_command>`;
    // Or for Computers: `<computer_command><general><command>DeviceLock</command><lock_message>Locked by Receptionist</lock_message><passcode>123456</passcode></general><computers><computer><id>${deviceId}</id></computer></computers></computer_command>`; 
    // Adjust XML based on whether it's a mobile device or computer API endpoint you target first

    try {
        // Use mobile device endpoint first, adjust based on findJamfDeviceIdBySerial logic if needed
        await jamfApiRequest('/mobiledevicecommands/command/EnableLostMode', 'POST', lockCommandXml);
        console.log(`Successfully sent lock command for device ID ${deviceId} (Serial: ${serialNumber})`);
    } catch (error) {
        console.error(`Failed to send lock command for device ID ${deviceId} (Serial: ${serialNumber}):`, error);
        // Decide how to handle errors - log, retry, notify admin?
    }
}

// Disable Lost Mode (Requires device ID)
export async function unlockDevice(serialNumber: string): Promise<void> {
    console.log(`Attempting to unlock device with serial: ${serialNumber}`);
    const deviceId = await findJamfDeviceIdBySerial(serialNumber);
    if (!deviceId) {
        console.error(`Cannot unlock device: Jamf ID not found for serial ${serialNumber}`);
        return; // Or throw error
    }

    // Command to disable lost mode (check Jamf API docs for exact command name and structure)
    const unlockCommandXml = `<mobile_device_command><general><command>DisableLostMode</command></general><mobile_devices><mobile_device><id>${deviceId}</id></mobile_device></mobile_devices></mobile_device_command>`;
    // Or for Computers (might be ClearPasscode command or removing lock command)

    try {
        // Adjust endpoint if needed (e.g., computercommands)
        await jamfApiRequest('/mobiledevicecommands/command/DisableLostMode', 'POST', unlockCommandXml);
        console.log(`Successfully sent unlock command for device ID ${deviceId} (Serial: ${serialNumber})`);
    } catch (error) {
        console.error(`Failed to send unlock command for device ID ${deviceId} (Serial: ${serialNumber}):`, error);
    }
} 