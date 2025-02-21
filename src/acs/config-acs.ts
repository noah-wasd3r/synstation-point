//

export const acsDistributionTimestamp = {
  epoch1StartTimestamp: 1740009601, // UTC: 2022-02-19T00:00:01Z
  epoch1EndTimestamp: 1740096000, // UTC: 2022-02-20T00:00:00Z
};
// export const acsDistributionTimestamp = {
//   epoch1StartTimestamp: Math.floor(new Date().getTime() / 1000) - 86400 - 1, // UTC: 2022-02-19T00:00:01Z
//   epoch1EndTimestamp: Math.floor(new Date().getTime() / 1000) - 1, // UTC: 2022-02-20T00:00:00Z
// };

export function getEpochStartTimestamp(epoch: number) {
  const epochStartTimestamp = acsDistributionTimestamp.epoch1StartTimestamp;
  return epochStartTimestamp + (epoch - 1) * 86400;
}

export function getEpochEndTimestamp(epoch: number) {
  const epochEndTimestamp = acsDistributionTimestamp.epoch1EndTimestamp;
  return epochEndTimestamp + (epoch - 1) * 86400;
}

export function getPastEpochUsingTimestamp(timestamp: number) {
  const epoch = Math.floor((timestamp - acsDistributionTimestamp.epoch1EndTimestamp) / 86400) + 1;
  return epoch;
}

// console.log(new Date(getEpochStartTimestamp(1) * 1000).toISOString());
// console.log(new Date(getEpochEndTimestamp(1) * 1000).toISOString());

// console.log(new Date(getEpochStartTimestamp(2) * 1000).toISOString());
// console.log(new Date(getEpochEndTimestamp(2) * 1000).toISOString());

// console.log(new Date(getEpochStartTimestamp(3) * 1000).toISOString());
// console.log(new Date(getEpochEndTimestamp(3) * 1000).toISOString());
