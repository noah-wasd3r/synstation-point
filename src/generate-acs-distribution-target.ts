import fs from 'fs';
import { getEpochEndTimestamp, getEpochStartTimestamp } from './acs/config-acs';
import { checksumAddress } from 'viem';

export async function generateAcsDistributionTarget(epoch: number) {
  const now = Math.floor(Date.now() / 1000);

  const fromTimestamp = getEpochStartTimestamp(epoch);
  const toTimestamp = getEpochEndTimestamp(epoch);

  if (fromTimestamp > now) {
    console.error('Error: fromTimestamp must be in the past');
    process.exit(1);
  }

  if (toTimestamp > now) {
    console.error('Error: toTimestamp must be in the past');
    process.exit(1);
  }

  if (isNaN(fromTimestamp) || isNaN(toTimestamp)) {
    console.error('Error: Timestamps must be valid numbers');
    process.exit(1);
  }

  console.log(
    'epoch',
    epoch,
    'from UTC',
    new Date(fromTimestamp * 1000).toISOString(),
    'to UTC',
    new Date(toTimestamp * 1000).toISOString()
  );

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

  const balanceMap: {
    [user: string]: {
      [vaultAddress: string]: number;
    };
  } = {};
  const accumulatedSharesMap: {
    [user: string]: {
      [vaultAddress: string]: {
        updatedAt: number;
        accumulatedShares: number;
      };
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

      accumulatedSharesMap[receiver] = accumulatedSharesMap[receiver] || {};
      accumulatedSharesMap[receiver][vaultAddress] = {
        updatedAt: fromTimestamp,
        accumulatedShares: balanceMap[receiver][vaultAddress],
      };
    } else if (type === 'withdraw') {
      balanceMap[owner] = balanceMap[owner] || {};
      balanceMap[owner][vaultAddress] = balanceMap[owner][vaultAddress] || 0;
      balanceMap[owner][vaultAddress] -= shares;

      accumulatedSharesMap[owner] = accumulatedSharesMap[owner] || {};
      accumulatedSharesMap[owner][vaultAddress] = {
        updatedAt: fromTimestamp,
        accumulatedShares: balanceMap[owner][vaultAddress],
      };
    }
  }

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

  const arrayfied = Object.entries(powerMap)
    .map(([address, power]) => ({ address, power }))
    .sort((a, b) => b.power - a.power)
    .filter(({ power }) => power > 0);

  const autopilotLiquidityProvisionResult = arrayfied.map(({ address, power }) => ({
    address,
    ratio: power / totalPower,
  }));

  // get swap volume part

  const swapHistoryUrl = process.env.PONDER_SWAP_HISTORY_URL as string;
  if (!swapHistoryUrl) {
    console.error('Error: PONDER_SWAP_HISTORY_URL is not set');
    process.exit(1);
  }

  const gm = '0x7f81f7e9d9bfc0786868127eec62eeb440193b3a';

  const swapHistoryResponse = await fetch(swapHistoryUrl);
  const swapHistoryData = (await swapHistoryResponse.json()) as {
    id: string; // tx hash
    timestamp: number;
    fromToken: string;
    toToken: string;
    txSender: string;
    amountIn: number;
    amountInGm: number;
    amountOut: number;
  }[];

  const filteredByTimestamp = swapHistoryData.filter((item) => item.timestamp >= fromTimestamp && item.timestamp <= toTimestamp);

  const userVolumeMap: Record<string, number> = {};
  let totalVolume = 0;

  for (const item of filteredByTimestamp) {
    const volumeInGm = item.amountInGm;

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

  const userBaseScoreMap: Record<string, number> = {};
  const userFinalScoreMap: Record<string, number> = {};

  let totalBaseScore = 0;
  let totalFinalScore = 0;

  for (const item of arrfyAndSorted) {
    const baseScore = Math.max(0, item.volume);

    userBaseScoreMap[item.address] = baseScore;
    userFinalScoreMap[item.address] = baseScore;
    totalBaseScore += baseScore;
    totalFinalScore += baseScore;
  }

  // if parentReferralCode is not null, then add 20% of the baseScore to the userBaseScoreMap to the parentReferralCodeOwner
  for (const item of arrfyAndSorted) {
    const referralTable = JSON.parse(fs.readFileSync('./result/referral-table.json', 'utf8'));
    const foundReferral = referralTable.find((tableItem: any) => tableItem.address === item.address);
    if (!foundReferral) {
      continue;
    }
    if (!foundReferral.parentReferralCode) {
      continue;
    }

    // *** handle direct parent referral code ***
    const parentReferralCodeOwner = referralTable.find((tableItem: any) => tableItem.referralCode === foundReferral.parentReferralCode);
    if (!parentReferralCodeOwner) {
      continue;
    }
    if (!userFinalScoreMap[parentReferralCodeOwner.address]) {
      userFinalScoreMap[parentReferralCodeOwner.address] = 0;
    }

    userFinalScoreMap[parentReferralCodeOwner.address] += userBaseScoreMap[item.address] * 0.2;
    totalFinalScore += userBaseScoreMap[item.address] * 0.2;

    const parentOfParentReferralCodeOwner = referralTable.find(
      (tableItem: any) => tableItem.referralCode === parentReferralCodeOwner.parentReferralCode
    );
    if (!parentOfParentReferralCodeOwner) {
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
    .sort((a, b) => b.fs - a.fs)
    .filter(({ fs }) => fs > 0);

  console.log('totalBaseScore', totalBaseScore);
  console.log('totalFinalScore', totalFinalScore);

  const swapVolumeFinalScoreResult = arrfyAndSortedFinalScore.map(({ address, bs, fs }) => ({
    address,
    ratio: fs / totalFinalScore,
    bs,
    fs,
    volume: userVolumeMap[address],
  }));

  const dataToStore = {
    autopilotLiquidityProvision: {
      result: autopilotLiquidityProvisionResult.map((e) => ({
        ...e,
        address: checksumAddress(e.address as `0x${string}`),
      })),
    },
    swapVolume: {
      totalVolume,
      result: swapVolumeFinalScoreResult.map((e) => ({
        ...e,
        address: checksumAddress(e.address as `0x${string}`),
      })),
    },
    distributed: false,
  };

  fs.writeFileSync(`./acs-data/acs-distribution-target-${epoch}.json`, JSON.stringify(dataToStore, null, 2));
}
