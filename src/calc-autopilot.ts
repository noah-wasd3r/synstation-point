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

const url = process.env.PONDER_AUTOPILOT_HISTORY_URL as string;
if (!url) {
  console.error('Error: PONDER_AUTOPILOT_HISTORY_URL is not set');
  process.exit(1);
}
const response = await fetch(url);
const data = (await response.json()) as {
  depositEvents: {
    id: string;
    vaultAddress: string;
    sender: string;
    receiver: string;
    assets: number;
    shares: number;
    timestamp: number;
  }[];
  withdrawEvents: {
    id: string;
    vaultAddress: string;
    sender: string;
    receiver: string;
    owner: string;
    assets: number;
    shares: number;
    timestamp: number;
  }[];
};

const concatedEvents = [
  ...data.depositEvents.map((e) => {
    return { ...e, type: 'deposit' };
  }),
  ...data.withdrawEvents.map((e) => {
    return { ...e, type: 'withdraw' };
  }),
].sort((a, b) => a.timestamp - b.timestamp);

const gm = '0x7f81f7e9d9bfc0786868127eec62eeb440193b3a';

// create balance maps and calculate the time weighted average balance

// fs.writeFileSync(`./result/autopilot-${fromTimestamp}-${toTimestamp}.json`, JSON.stringify(concatedEvents, null, 2));

// 2. start from fromTimestamp, calculate time weighted average balance of all users

/// if we calculate for 86400 seconds, and user deposit in this period, at 43200 seconds passed,
// (initial balance * 43200 + new balance * 43200) / 86400 =

// 1. calculate balance map of fromTimestamp of all users
// user, vaultAddress, balance
const balanceMap: {
  [user: string]: {
    [vaultAddress: string]: number;
  };
} = {};

for (const event of concatedEvents) {
  // check timestamp

  if (event.timestamp > fromTimestamp) {
    break;
  }

  // @ts-ignore
  const { receiver, vaultAddress, type, assets, shares, timestamp, owner } = event;
  if (type === 'deposit') {
    balanceMap[receiver] = balanceMap[receiver] || {};
    balanceMap[receiver][vaultAddress] = balanceMap[receiver][vaultAddress] || 0;
    balanceMap[receiver][vaultAddress] += shares;
  } else if (type === 'withdraw') {
    balanceMap[owner] = balanceMap[owner] || {};
    balanceMap[owner][vaultAddress] = balanceMap[owner][vaultAddress] || 0;
    balanceMap[owner][vaultAddress] -= shares;
  }
}

const accumulatedSharesMap: {
  [user: string]: {
    [vaultAddress: string]: {
      updatedAt: number;
      accumulatedShares: number;
    };
  };
} = {};

for (const event of concatedEvents) {
  if (event.timestamp <= fromTimestamp) {
    continue;
  }

  if (event.timestamp > toTimestamp) {
    break;
  }
  // @ts-ignore
  const { receiver, vaultAddress, type, assets, shares, timestamp, owner } = event;

  if (type === 'deposit') {
    balanceMap[receiver] = balanceMap[receiver] || {};
    balanceMap[receiver][vaultAddress] = balanceMap[receiver][vaultAddress] || 0;

    // update accumulatedSharesMap

    accumulatedSharesMap[receiver] = accumulatedSharesMap[receiver] || {};
    accumulatedSharesMap[receiver][vaultAddress] = accumulatedSharesMap[receiver][vaultAddress] || {
      updatedAt: timestamp,
      accumulatedShares: 0,
    };
    const lastShares = balanceMap[receiver][vaultAddress];

    const timeElasped = timestamp - accumulatedSharesMap[receiver][vaultAddress].updatedAt;
    const toAddShares = timeElasped * lastShares;
    accumulatedSharesMap[receiver][vaultAddress].accumulatedShares += toAddShares;
    accumulatedSharesMap[receiver][vaultAddress].updatedAt = timestamp;

    balanceMap[receiver][vaultAddress] += shares;
  } else if (type === 'withdraw') {
    balanceMap[owner] = balanceMap[owner] || {};
    balanceMap[owner][vaultAddress] = balanceMap[owner][vaultAddress] || 0;

    accumulatedSharesMap[owner] = accumulatedSharesMap[owner] || {};
    accumulatedSharesMap[owner][vaultAddress] = accumulatedSharesMap[owner][vaultAddress] || {
      updatedAt: timestamp,
      accumulatedShares: 0,
    };
    const lastShares = balanceMap[owner][vaultAddress];

    const timeElasped = timestamp - accumulatedSharesMap[owner][vaultAddress].updatedAt;
    const toAddShares = timeElasped * lastShares;
    accumulatedSharesMap[owner][vaultAddress].accumulatedShares += toAddShares;
    accumulatedSharesMap[owner][vaultAddress].updatedAt = timestamp;

    balanceMap[owner][vaultAddress] -= shares;
  }
}

// so we have now accumulatedSharesMap for all users and vaults
// finally we need to calculate all accumulatedSharesMap updatedAt timestamps to toTimestamp

const referencePriceDataForPower = {
  ['0x3BaC111A6F5ED6A554616373d5c7D858d7c10d88'.toLowerCase()]: 0.04, //astr
  ['0x467b43ede72543FC0FD79c7085435A484a87e0D7'.toLowerCase()]: 2700, //nrETH
  ['0x74dFFE1e68f41ec364517f1F2951047246c5DD4e'.toLowerCase()]: 0.04, //nsASTR
  ['0x2C7f58d2AfaCae1199c7e1E00FB629CCCEA5Bbd5'.toLowerCase()]: 1, //USDC
  ['0x6A31048E5123859cf50F865d5a3050c18E77fFAe'.toLowerCase()]: 1, //USDT
  ['0xefb3Cc73a5517c9825aE260468259476e7965c5E'.toLowerCase()]: 2700, //WETH
};
const referenceDecimal = {
  ['0x3BaC111A6F5ED6A554616373d5c7D858d7c10d88'.toLowerCase()]: 18, //astr
  ['0x467b43ede72543FC0FD79c7085435A484a87e0D7'.toLowerCase()]: 18, //nrETH
  ['0x74dFFE1e68f41ec364517f1F2951047246c5DD4e'.toLowerCase()]: 18, //nsASTR
  ['0x2C7f58d2AfaCae1199c7e1E00FB629CCCEA5Bbd5'.toLowerCase()]: 6, //USDC
  ['0x6A31048E5123859cf50F865d5a3050c18E77fFAe'.toLowerCase()]: 6, //USDT
  ['0xefb3Cc73a5517c9825aE260468259476e7965c5E'.toLowerCase()]: 18, //WETH
};

let totalPower = 0;
const powerMap: {
  [user: string]: number;
} = {};

for (const user in accumulatedSharesMap) {
  for (const vaultAddress in accumulatedSharesMap[user]) {
    const { updatedAt, accumulatedShares } = accumulatedSharesMap[user][vaultAddress];
    const timeElasped = toTimestamp - updatedAt;
    const toAddShares = timeElasped * balanceMap[user][vaultAddress];
    accumulatedSharesMap[user][vaultAddress].accumulatedShares += toAddShares;

    powerMap[user] = powerMap[user] || 0;

    const powerToAdd =
      (accumulatedSharesMap[user][vaultAddress].accumulatedShares * referencePriceDataForPower[vaultAddress]) /
      Math.pow(10, referenceDecimal[vaultAddress]);

    powerMap[user] += powerToAdd;
    totalPower += powerToAdd;
  }
}
fs.writeFileSync(`./result/accumulated-shares-map-${fromTimestamp}-${toTimestamp}.json`, JSON.stringify(accumulatedSharesMap, null, 2));

// array {address, power}
const arrayfied = Object.entries(powerMap)
  .map(([address, power]) => ({ address, power }))
  .sort((a, b) => b.power - a.power);

const result = {
  totalPower,
  powerData: arrayfied,
};

fs.writeFileSync(`./result/autopilot-power-map-${fromTimestamp}-${toTimestamp}.json`, JSON.stringify(result, null, 2));
