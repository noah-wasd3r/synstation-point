import fs from 'fs';
// Get command line arguments
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error('Usage: bun run src/calc-point.ts <fromTimestamp> <toTimestamp>');
  process.exit(1);
}

const fromTimestamp = parseInt(args[0]);
const toTimestamp = parseInt(args[1]);

if (isNaN(fromTimestamp) || isNaN(toTimestamp)) {
  console.error('Error: Timestamps must be valid numbers');
  process.exit(1);
}

console.log(fromTimestamp, toTimestamp);

const url = process.env.PONDER_SWAP_HISTORY_URL as string;
if (!url) {
  console.error('Error: PONDER_SWAP_HISTORY_URL is not set');
  process.exit(1);
}

const gm = '0x7f81f7e9d9bfc0786868127eec62eeb440193b3a';

const response = await fetch(url);
const data = (await response.json()) as {
  id: string; // tx hash
  timestamp: number;
  fromToken: string;
  toToken: string;
  txSender: string;
  amountIn: number;
  amountOut: number;
}[];

const filteredByTimestamp = data.filter((item) => item.timestamp >= fromTimestamp && item.timestamp <= toTimestamp);

const userVolumeMap = {};
let totalVolume = 0;

for (const item of filteredByTimestamp) {
  const volumeInGm = item.fromToken === gm ? item.amountIn : item.amountOut;

  if (!userVolumeMap[item.txSender]) {
    userVolumeMap[item.txSender] = 0;
  }

  totalVolume += volumeInGm / 1e6;

  userVolumeMap[item.txSender] += volumeInGm / 1e6;
}

const arrfyAndSorted = Object.entries(userVolumeMap)
  .map(([address, volume]) => ({
    address,
    volume,
  }))
  .sort((a, b) => b.volume - a.volume);

console.log('totalVolume', totalVolume);

fs.writeFileSync(`./result/volume-${fromTimestamp}-${toTimestamp}.json`, JSON.stringify(arrfyAndSorted, null, 2));

// const basePoint = max(feeEarned * 2 , volume) // will be always volume because there is no fee earned for now

// const finalPoint = basePoint  + 1stReferralsBasePoint*20% + 2ndReferralsBasePoint*4%

// set baseScore for each user
const userBaseScoreMap: Record<string, number> = {};
const userFinalScoreMap: Record<string, number> = {};

let totalBaseScore = 0;
let totalFinalScore = 0;

for (const item of arrfyAndSorted) {
  const baseScore = Math.max(0, item.volume);

  userBaseScoreMap[item.address] = baseScore;
  userFinalScoreMap[item.address] = baseScore;
  totalBaseScore += baseScore;
}

// if parentReferralCode is not null, then add 20% of the baseScore to the userBaseScoreMap to the parentReferralCodeOwner
for (const item of arrfyAndSorted) {
  const referralTable = JSON.parse(fs.readFileSync('./result/referral-table.json', 'utf8'));
  const foundReferral = referralTable.find((tableItem: any) => tableItem.address === item.address);
  if (!foundReferral) {
    console.log('not found referral for', item.address);
    continue;
  }
  if (!foundReferral.parentReferralCode) {
    console.log('not found parent referral code for', item.address);
    continue;
  }

  // *** handle direct parent referral code ***
  const parentReferralCodeOwner = referralTable.find((tableItem) => tableItem.referralCode === foundReferral.parentReferralCode);
  if (!parentReferralCodeOwner) {
    console.log('not found parent referral code owner for', item.address);
    continue;
  }
  if (!userFinalScoreMap[parentReferralCodeOwner.address]) {
    userFinalScoreMap[parentReferralCodeOwner.address] = 0;
  }

  userFinalScoreMap[parentReferralCodeOwner.address] += userBaseScoreMap[item.address] * 0.2;
  totalFinalScore += userBaseScoreMap[item.address] * 0.2;

  // end of handle direct parent referral code

  // give 4% of the baseScore to the parent of the parentReferralCodeOwner
  const parentOfParentReferralCodeOwner = referralTable.find(
    (tableItem: any) => tableItem.referralCode === parentReferralCodeOwner.parentReferralCode
  );
  if (!parentOfParentReferralCodeOwner) {
    console.log('not found parent of parent referral code owner for', item.address);
    continue;
  }
  if (!userFinalScoreMap[parentOfParentReferralCodeOwner.address]) {
    userFinalScoreMap[parentOfParentReferralCodeOwner.address] = 0;
  }
  userFinalScoreMap[parentOfParentReferralCodeOwner.address] += userBaseScoreMap[item.address] * 0.04;
  totalFinalScore += userBaseScoreMap[item.address] * 0.04;
}

const arrfyAndSortedFinalScore = Object.entries(userFinalScoreMap)
  .map(([address, score]) => ({
    address,
    bs: userBaseScoreMap[address] || 0,
    fs: score,
  }))
  .sort((a, b) => b.fs - a.fs);

console.log('totalBaseScore', totalBaseScore);
console.log('totalFinalScore', totalFinalScore);

const result = {
  totalBaseScore,
  totalFinalScore: totalBaseScore + totalFinalScore,
  data: arrfyAndSortedFinalScore,
};

fs.writeFileSync(`./result/volume-final-score-${fromTimestamp}-${toTimestamp}.json`, JSON.stringify(result, null, 2));
