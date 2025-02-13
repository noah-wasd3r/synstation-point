import { generateSignatureHeader, type AcsSignatureItem } from './request-header';
import fs from 'fs';
const acsBaseUrl = process.env.ACS_BASE_URL;
if (!acsBaseUrl) {
  throw new Error('ACS_BASE_URL is not set');
}
const synstationDefiId = Number(process.env.ACS_SYNSTATION_DEFI_ID) || 0;
if (!synstationDefiId) {
  throw new Error('ACS_SYNSTATION_DEFI_ID is not set');
}
async function getDefiPointInfoForSynstation() {
  const result = await fetch(`${acsBaseUrl}/acs/getDefiPointInfo?defiId=${synstationDefiId}`);
  const data = (await result.json()) as {
    defiId: string;
    totalPoints: number;
    totalUsedPointsToday: number;
    remainingPoints: number;
  };
  return data;
}
// getDefiPointInfoForSynstation().then((data) => {
//   console.log(data);
// });

async function distributeAcsPoints(items: AcsSignatureItem[]) {
  // POST /acs/addDiscretionaryPointsBatch

  const signatureHeader = generateSignatureHeader(items);
  const response = await fetch(`${acsBaseUrl}/acs/addDiscretionaryPointsBatch`, {
    method: 'POST',
    headers: {
      ...signatureHeader,
    },
    body: JSON.stringify(items),
  });

  const data = await response.json();

  if (data.statusCode === 201) {
    console.log('Points distributed successfully');

    // create log file with items

    fs.writeFileSync(`./logs/acs-points-distributed-${Date.now()}.json`, JSON.stringify(items, null, 2));
  } else {
    console.error('Failed to distribute points', data);
  }
}
