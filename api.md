# API Documentation

This document outlines the available API endpoints, their expected payloads, and responses.

---

## Shipments API

### `POST /api/shipments`

Creates a new shipment from the admin interface. Requires authentication via session cookie.

**Request Body:**

```json
{
  "senderName": "string (required)",
  "senderEmail": "string (required, valid email)",
  "locationValue": "string (required, can be Location ID or new Location Name)",
  "trackingNumber": "string (optional)",
  "notifyEmails": "string | string[] (optional, comma-separated string or array of emails)",
  "devices": [
    {
      "serialNumber": "string (required)",
      "assetTag": "string (optional)",
      "model": "string (optional)"
    }
    // ... more devices
  ]
}
```

**Response (201 Created):**

Returns the newly created shipment object, including nested `devices` and `location` details.

```json
{
  "id": "string (cuid)",
  "shortId": "string (6 chars, uppercase)",
  "createdAt": "string (ISO 8601)",
  "updatedAt": "string (ISO 8601)",
  "senderName": "string",
  "senderEmail": "string",
  "status": "PENDING | IN_TRANSIT | DELIVERED | RECEIVED | COMPLETED | CANCELLED",
  "trackingNumber": "string | null",
  "manifestUrl": "string | null",
  "recipientName": "string | null",
  "recipientEmail": "string | null",
  "recipientSignature": "string | null",
  "trackingId": "string | null",
  "trackingInfo": "object | null",
  "receivedAt": "string (ISO 8601) | null",
  "locationId": "string (cuid)",
  "carrier": "string | null",
  "clientReferenceId": "string | null",
  "notes": "string | null",
  "location": {
    // Full Location object
    "id": "string (cuid)",
    "name": "string",
    "recipientEmails": ["string"],
    "createdAt": "string (ISO 8601)",
    "updatedAt": "string (ISO 8601)",
    "shortId": "string | null"
    // ... other Location fields
  },
  "devices": [
    {
      // Full Device object
      "id": "string (cuid)",
      "serialNumber": "string",
      "assetTag": "string | null",
      "model": "string | null",
      "isCheckedIn": false,
      "checkedInAt": "string (ISO 8601) | null",
      "shipmentId": "string (cuid)"
    }
    // ... more devices
  ]
}
```

**Error Responses:**

*   `400 Bad Request`: Missing required fields, invalid location value, or device data.
*   `401 Unauthorized`: User not authenticated.
*   `409 Conflict`: Unique constraint violation (e.g., duplicate serial number).
*   `500 Internal Server Error`: Failed to create shipment after retries or other server issues.

---

### `GET /api/shipments`

Lists shipments based on query parameters. Requires authentication via session cookie.

**Query Parameters:**

*   `sortBy`: `string` (Field to sort by, default: `createdAt`)
*   `sortOrder`: `asc | desc` (Sort direction, default: `desc`)
*   `status`: `PENDING | IN_TRANSIT | DELIVERED | RECEIVED | COMPLETED | CANCELLED` (Filter by status)
*   `search`: `string` (Search term for sender name/email, location name, device serial/asset tag/model)
*   `page`: `number` (Page number for pagination, default: `1`)
*   `limit`: `number` (Items per page, default: `15`)

**Response (200 OK):**

Returns an object containing an array of shipments and pagination metadata.

```json
{
  "shipments": [
    {
      // Minimal shipment data with counts and related names
      "id": "string (cuid)",
      "shortId": "string",
      "createdAt": "string (ISO 8601)",
      "senderName": "string",
      "status": "string (ShipmentStatus)",
      "trackingNumber": "string | null",
      "location": {
        "name": "string"
      },
      "_count": {
        "devices": "number"
      }
    }
    // ... more shipments
  ],
  "total": "number", // Total number of matching shipments
  "page": "number",  // Current page number
  "limit": "number", // Items per page
  "totalPages": "number" // Total number of pages
}
```

**Error Responses:**

*   `400 Bad Request`: Invalid query parameters (pagination, sortOrder, status).
*   `401 Unauthorized`: User not authenticated.
*   `500 Internal Server Error`: Database query error.

---

### `POST /api/shipments/new`

Creates a new shipment programmatically via API key.

**Headers:**

*   `X-API-Key`: `string (required)` - The plain text API key.

**Request Body (Validated by Zod):**

```json
{
  "senderName": "string (required)",
  "senderEmail": "string (required, valid email)",
  "destinationIdentifier": "string (required, Location ID or Name)",
  "clientReferenceId": "string (optional)",
  "carrier": "string (optional)",
  "trackingNumber": "string (optional)",
  "notes": "string (optional)",
  "notifyEmails": "string | string[] (optional, comma-separated string or array of emails)",
  "devices": [
    {
      "serialNumber": "string (required)",
      "assetTag": "string (optional)",
      "model": "string (optional)"
    }
    // ... more devices (at least one required)
  ]
}
```

**Response (201 Created):**

Returns the newly created shipment object, including nested `devices` and `location` details. (Same structure as `POST /api/shipments`)

**Error Responses:**

*   `400 Bad Request`: Invalid JSON format, validation error (Zod details provided).
*   `401 Unauthorized`: Missing or invalid API Key.
*   `404 Not Found`: Destination location not found using the identifier.
*   `409 Conflict`: Database unique constraint violation (e.g., duplicate serial number or clientReferenceId if unique).
*   `500 Internal Server Error`: Failed to create shipment after retries or other server issues.

---

### `GET /api/shipments/[shortId]`

Retrieves detailed information for a specific shipment by its `shortId`. Requires authentication via session cookie.

**Path Parameter:**

*   `shortId`: `string (6 chars, case-insensitive)`

**Response (200 OK):**

Returns the full shipment object, including nested `devices` and `location` details. (Same structure as `POST /api/shipments`)

**Error Responses:**

*   `400 Bad Request`: Invalid `shortId` format.
*   `401 Unauthorized`: User not authenticated.
*   `404 Not Found`: Shipment with the given `shortId` not found.
*   `500 Internal Server Error`: Database query error.

---

### `PUT /api/shipments/[shortId]`

Updates an existing shipment. Used by the admin interface. Requires authentication via session cookie.

**Path Parameter:**

*   `shortId`: `string (6 chars, case-insensitive)`

**Request Body:**

```json
{
  "senderName": "string (required)",
  "senderEmail": "string (required)",
  "status": "PENDING | IN_TRANSIT | DELIVERED | RECEIVED | COMPLETED | CANCELLED (required)",
  "trackingNumber": "string (optional)",
  "adminCheckedSerials": ["string"] // Optional: Array of serial numbers to mark as checked-in if status is COMPLETED
}
```

**Response (200 OK):**

Returns the updated shipment object, including nested `devices` and `location` details. (Same structure as `POST /api/shipments`)

**Error Responses:**

*   `400 Bad Request`: Invalid `shortId` format or invalid input data.
*   `401 Unauthorized`: User not authenticated.
*   `404 Not Found`: Shipment with the given `shortId` not found.
*   `409 Conflict`: Attempting to update a shipment whose status prevents updates (e.g., trying to change a `CANCELLED` shipment).
*   `500 Internal Server Error`: Database update error.

---

## Admin API

### `GET /api/admin/locations`

Retrieves a list of all locations with shipment counts and the latest shipment date. Requires authentication via session cookie.

**Response (200 OK):**

Returns an array of location objects.

```json
[
  {
    "id": "string (cuid)",
    // "shortId": "string | null", // Included if enabled
    "name": "string",
    "_count": {
      "shipments": "number"
    },
    "shipments": [ // Array will contain 0 or 1 element
      {
        "createdAt": "string (ISO 8601)"
      }
    ]
  }
  // ... more locations
]
```

**Error Responses:**

*   `401 Unauthorized`: User not authenticated.
*   `500 Internal Server Error`: Database query error.

---

### `GET /api/admin/apikeys`

Retrieves a list of all API keys (excluding the hash). Requires authentication via session cookie.

**Response (200 OK):**

Returns an array of API key objects.

```json
[
  {
    "id": "string (cuid)",
    "description": "string",
    "createdAt": "string (ISO 8601)",
    "lastUsedAt": "string (ISO 8601) | null",
    "isActive": "boolean"
  }
  // ... more api keys
]
```

**Error Responses:**

*   `401 Unauthorized`: User not authenticated.
*   `500 Internal Server Error`: Database query error.

---

### `POST /api/admin/apikeys`

Generates a new API key and stores its hash. Requires authentication via session cookie.

**Request Body:**

```json
{
  "description": "string (required)"
}
```

**Response (201 Created):**

Returns the newly created API key record **including the plain text key** (this is the only time it's available).

```json
{
  "id": "string (cuid)",
  "description": "string",
  "createdAt": "string (ISO 8601)",
  "isActive": true,
  "apiKey": "string (plain text key, e.g., concierge_...)"
}
```

**Error Responses:**

*   `400 Bad Request`: Missing or invalid description.
*   `401 Unauthorized`: User not authenticated.
*   `500 Internal Server Error`: Key generation or database error.

---

### `PATCH /api/admin/apikeys/[keyId]`

Updates an API key, specifically to toggle its `isActive` status. Requires authentication via session cookie.

**Path Parameter:**

*   `keyId`: `string (cuid)`

**Request Body:**

```json
{
  "isActive": "boolean (required)"
}
```

**Response (200 OK):**

Returns the updated API key record (excluding the hash).

```json
{
  "id": "string (cuid)",
  "isActive": "boolean",
  "description": "string"
}
```

**Error Responses:**

*   `400 Bad Request`: Missing or invalid `isActive` field.
*   `401 Unauthorized`: User not authenticated.
*   `404 Not Found`: API Key with the given `keyId` not found.
*   `500 Internal Server Error`: Database update error.

---

### `DELETE /api/admin/apikeys/[keyId]`

Revokes an API key by setting its `isActive` status to `false`. Requires authentication via session cookie.

**Path Parameter:**

*   `keyId`: `string (cuid)`

**Response (200 OK):**

```json
{
  "message": "API Key revoked successfully"
}
```

**Error Responses:**

*   `400 Bad Request`: Missing `keyId`.
*   `401 Unauthorized`: User not authenticated.
*   `404 Not Found`: API Key with the given `keyId` not found.
*   `500 Internal Server Error`: Database update error.

---

## Public API

### `GET /api/public/shipments/[shortId]`

Retrieves limited, public-safe details for a specific shipment by its `shortId`. Does **not** require authentication. Used for the receiving page.

**Path Parameter:**

*   `shortId`: `string (6 chars, case-insensitive)`

**Response (200 OK):**

Returns a limited view of the shipment.

```json
{
  "id": "string (cuid)",
  "shortId": "string",
  "senderName": "string",
  "createdAt": "string (ISO 8601)",
  "status": "PENDING | IN_TRANSIT | DELIVERED | RECEIVED | COMPLETED | CANCELLED",
  "devices": [
    {
      "id": "string (cuid)",
      "serialNumber": "string",
      "assetTag": "string | null",
      "model": "string | null"
      // isCheckedIn is NOT included
    }
    // ... more devices
  ],
  "location": { // Optional, only includes name if selected in query
    "name": "string"
  } | null
  // Other sensitive fields are excluded
}
```

**Error Responses:**

*   `400 Bad Request`: Invalid `shortId` format.
*   `404 Not Found`: Shipment with the given `shortId` not found.
*   `500 Internal Server Error`: Database query error.

---

### `PUT /api/public/shipments/[shortId]`

Submits the receiving information for a shipment (signature, recipient name, received devices). Does **not** require authentication.

**Path Parameter:**

*   `shortId`: `string (6 chars, case-insensitive)`

**Request Body:**

```json
{
  "recipientName": "string (required)",
  "signature": "string (required, data:image/png;base64,... format)",
  "receivedSerials": ["string (required, array of serial numbers received)"],
  "extraDevices": [ // Optional array for devices found but not on manifest
    {
      "serialNumber": "string (required)",
      "assetTag": "string (optional)",
      "model": "string (optional)"
    }
  ]
}
```

**Response (200 OK):**

Returns the final status of the shipment after processing the receipt.

```json
{
  "status": "RECEIVED" // Or potentially another status if logic changes
}
```

**Error Responses:**

*   `400 Bad Request`: Invalid `shortId` format, missing required fields, or invalid data format (signature, serials).
*   `404 Not Found`: Shipment with the given `shortId` not found.
*   `409 Conflict`: Shipment status does not allow receiving (e.g., already `CANCELLED` or `COMPLETED`).
*   `500 Internal Server Error`: Error during transaction (updating shipment/devices).

---

## Auth API

### `POST /api/auth/[...nextauth]`
### `GET /api/auth/[...nextauth]`

Handles NextAuth operations like sign-in, sign-out, session management, callbacks, etc., based on the configuration in `src/lib/auth.ts`. Specific endpoints depend on the providers and actions used (e.g., `/api/auth/signin`, `/api/auth/callback/credentials`, `/api/auth/session`).

**Payloads & Responses:** Managed by NextAuth based on the flow (e.g., sign-in form submission, session requests). Refer to NextAuth documentation for details.

--- 