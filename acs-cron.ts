// every 1 hour, chec

import { getPointInfo } from './src/acs/check-point';
import { getEpochEndTimestamp, getPastEpochUsingTimestamp } from './src/acs/config-acs';
import { distributeAcsPointForExactEpoch } from './src/acs/distribute-acs-point';
import { generateAcsDistributionTarget } from './src/generate-acs-distribution-target';
import fs from 'fs';
async function main() {
  const now = Math.floor(Date.now() / 1000);

  const pastEpoch = getPastEpochUsingTimestamp(now);

  console.log('pastEpoch', pastEpoch);

  const pastEpochEndTimestamp = getEpochEndTimestamp(pastEpoch);

  if (pastEpoch > 0) {
    if (now > pastEpochEndTimestamp) {
      console.log('can distribute');

      const currentPointInfo = await getPointInfo();

      // check if data is already generated

      const distributionTargetFilePath = `./acs-data/acs-distribution-target-${pastEpoch}.json`;
      if (fs.existsSync(distributionTargetFilePath)) {
        console.log('distribution target file already exists');
      } else {
        await generateAcsDistributionTarget(pastEpoch);
      }

      const autopilotLogFilePath = `./acs-log/acs-points-distributed-${pastEpoch}-autopilot.json`;
      const swapVolumeLogFilePath = `./acs-log/acs-points-distributed-${pastEpoch}-swap-volume.json`;

      if (fs.existsSync(autopilotLogFilePath) && fs.existsSync(swapVolumeLogFilePath)) {
        console.log('autopilot and swap volume log file already exists');

        console.log('wait till next epoch', pastEpochEndTimestamp + 86400 - now, 'seconds left to end of epoch');
      } else {
        await distributeAcsPointForExactEpoch(pastEpoch, currentPointInfo.data.getDefiPointInfoByDefiId.dailyPoints);
      }
    } else {
      console.log('cannot distribute wait: ', pastEpochEndTimestamp - now, 'seconds left to end of epoch');
    }
  } else {
    console.log('no past epoch');
  }
  await new Promise((resolve) => setTimeout(resolve, 1000 * 60 * 60));

  main();
}

main();
