import fs from 'fs';
const acsBaseUrl = process.env.ACS_BASE_URL;
if (!acsBaseUrl) {
  throw new Error('ACS_BASE_URL is not set');
}
const synstationDefiId = Number(process.env.ACS_SYNSTATION_DEFI_ID) || 0;
if (!synstationDefiId) {
  throw new Error('ACS_SYNSTATION_DEFI_ID is not set');
}
import * as crypto from 'crypto';
export interface AcsSignatureItem {
  userAddress: string;
  defiId: number;
  acsAmount: number;
  description: string;
}
interface SignatureParams {
  items: AcsSignatureItem[];
  timestamp: number;
  nonce: string;
  apiSecret: string;
}

export function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}
function generateSignature(params: SignatureParams): string {
  const { items, timestamp, nonce, apiSecret } = params;

  // Build the signature string
  const signStr = items.reduce((acc, item, idx) => {
    const itemStr = Object.keys(item)
      .sort()
      .map((key) => `${key}=${item[key as keyof AcsSignatureItem]}`)
      .join('&');
    return idx === 0 ? itemStr : `${acc}&${itemStr}`;
  }, '');

  // Add timestamp and nonce
  const finalStr = `${signStr}&timestamp=${timestamp}&nonce=${nonce}`;

  // Generate signature
  return crypto.createHmac('sha256', apiSecret).update(Buffer.from(finalStr)).digest('hex');
}

export async function distributeAcsPoints(items: AcsSignatureItem[]) {
  const nonce = generateNonce();
  const timestamp = Date.now();

  const signature = generateSignature({
    items,
    timestamp,
    nonce,
    apiSecret: process.env.ACS_SECRET_KEY!!,
  });

  const response = await fetch(`${acsBaseUrl}/acs/addDiscretionaryPointsBatch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-timestamp': timestamp.toString(),
      'x-nonce': nonce,
      'x-signature': signature,
    },
    body: JSON.stringify(items),
  });

  const data = await response.json();
  if (response.status === 201) {
    console.log('Points distributed successfully');

    return true;
  } else {
    console.error('Failed to distribute points', data);
    return false;
  }
}
