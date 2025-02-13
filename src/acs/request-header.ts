import crypto from 'crypto';
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

function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

function generateSignatureHeader(items: AcsSignatureItem[]) {
  const timestamp = Date.now();
  const nonce = generateNonce();
  const apiSecret = process.env.ACS_SECRET_KEY;
  if (!apiSecret) {
    throw new Error('ACS_SECRET_KEY is not set');
  }
  const signature = generateSignature({ items, timestamp, nonce, apiSecret });
  return {
    'x-signature': signature,
    'x-timestamp': timestamp.toString(),
    'x-nonce': nonce,
  };
}

export { generateSignatureHeader };
