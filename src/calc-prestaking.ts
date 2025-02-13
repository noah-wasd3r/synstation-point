import fs from 'fs';

const { data } = JSON.parse(fs.readFileSync('./data/prestaking-data.json', 'utf8'));

let totalPoints = 0;

const userPointMap = {};

for (const user of data.userStakings.items) {
  totalPoints += Number(user.accumulatedPoints) / 1e26;

  if (!userPointMap[user.userId]) {
    userPointMap[user.userId] = 0;
  }

  userPointMap[user.userId] += Number(user.accumulatedPoints) / 1e26;
}

for (const user of data.userPreStakings.items) {
  if (!userPointMap[user.userId]) {
    userPointMap[user.userId] = 0;
  }

  const prestakingEndTimestamp = 1736747999;
  const preStakingPoint =
    Number(user.pointPerSecond) * (prestakingEndTimestamp - Number(user.lastTimestamp)) + Number(user.accumulatedPoints);

  totalPoints += preStakingPoint / 1e26;
  userPointMap[user.userId] += preStakingPoint / 1e26;

  //
}

// Handle referral bonus, if user has parent referral, add 5% of the points
// for parent, add 5% points of all childrens points

const referralTable = JSON.parse(fs.readFileSync('./result/referral-table.json', 'utf8'));

const referralBonusMap: Record<string, number> = {};
Object.entries(userPointMap).forEach(([address, points]) => {
  const referral = referralTable.find((referralData: any) => referralData.address === address.toLowerCase());
  if (!referral) {
    return;
  }
  if (!referral.parentReferralCode) {
    return;
  }
  if (!referralBonusMap[address]) {
    referralBonusMap[address] = 0;
  }
  referralBonusMap[address] += points * 0.05;
  console.log('to ', address, points * 0.05);
  const parentReferral = referralTable.find((referralData: any) => referralData.referralCode === referral.parentReferralCode);
  if (!parentReferral) {
    return;
  }
  if (!referralBonusMap[parentReferral.address]) {
    referralBonusMap[parentReferral.address] = 0;
  }
  referralBonusMap[parentReferral.address] += points * 0.05;
  console.log('to ', parentReferral.address, points * 0.05);
});

const arrfyAndSorted = Object.entries(userPointMap)
  .map(([address, points]) => ({
    address,
    stakingPoint: points,
    referralBonus: referralBonusMap[address.toLowerCase()] || 0,
  }))
  .sort((a, b) => b.stakingPoint - a.stakingPoint);

console.log('totalPoints', totalPoints);
// console.log(referralBonusMap);

fs.writeFileSync('./result/prestaking-result.json', JSON.stringify(arrfyAndSorted, null, 2));
