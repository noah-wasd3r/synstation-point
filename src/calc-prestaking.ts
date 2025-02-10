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

const arrfyAndSorted = Object.entries(userPointMap)
  .map(([address, points]) => ({
    address,
    stakingPoint: points,
  }))
  .sort((a, b) => b.stakingPoint - a.stakingPoint);

console.log('totalPoints', totalPoints);

// fs.writeFileSync('./result/prestaking-result.json', JSON.stringify(arrfyAndSorted, null, 2));
