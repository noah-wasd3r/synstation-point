import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { distributeAcsPoints, type AcsSignatureItem } from './distributeAcsPointFunc';

export async function distributeAcsPointForExactEpoch(epoch: number, dailyTotalPoint: number) {
  const data = JSON.parse(fs.readFileSync(`./acs-data/acs-distribution-target-${epoch}.json`, 'utf8'));

  function confirmExecution() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise<boolean>((resolve) => {
      rl.question('Are you sure you want to execute distribute? (yes/no) ', (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
      });
    });
  }

  // Main execution flow
  const isConfirmed = await confirmExecution();

  if (isConfirmed) {
    // Execute distribute logic here
    console.log('Executing distribute with data:');

    const totalDistributionAmount = dailyTotalPoint;

    // data has 2 parts:
    // 1. autopilotLiquidityProvision
    // 2. swapVolume

    console.log('init autopilot liquidity provision distribution using 50% of total distribution amount');
    const { autopilotLiquidityProvision } = data;
    const { result: autopilotLiquidityProvisionResult } = autopilotLiquidityProvision;

    const autopilotLiquidityProvisionDistributionAmount = totalDistributionAmount * 0.5;

    const autopilotDistributionItems: AcsSignatureItem[] = autopilotLiquidityProvisionResult
      .map((item: any) => ({
        userAddress: item.address,
        defiId: Number(process.env.ACS_SYNSTATION_DEFI_ID),
        acsAmount: Math.floor(autopilotLiquidityProvisionDistributionAmount * item.ratio),
        description: `autopilot-${epoch}`,
      }))
      .filter((item: AcsSignatureItem) => item.acsAmount > 0);
    const autopilotLogFilePath = `./acs-log/acs-points-distributed-${epoch}-autopilot.json`;

    if (fs.existsSync(autopilotLogFilePath)) {
      console.log('Autopilot Points distribution already exists');
    } else {
      const isAutopilotDistributed = await distributeAcsPoints(autopilotDistributionItems);
      if (isAutopilotDistributed) {
        fs.writeFileSync(autopilotLogFilePath, JSON.stringify(autopilotDistributionItems, null, 2));
        console.log('isAutopilotDistributed', isAutopilotDistributed);
      } else {
        console.error('failed to distribute autopilot points');
      }

      // for (const autopilotTargetItem of autopilotDistributionItems) {
      //   console.log('distributing autopilot points', autopilotTargetItem.userAddress, autopilotTargetItem.acsAmount);
      //   const isAutopilotDistributed = await distributeAcsPoints([
      //     {
      //       acsAmount: autopilotTargetItem.acsAmount,
      //       defiId: autopilotTargetItem.defiId,
      //       userAddress: autopilotTargetItem.userAddress,
      //       description: autopilotTargetItem.description,
      //     },
      //   ]);
      //   const newAutopilotDistributionItems = autopilotDistributionItems.map((item) => {
      //     if (item.userAddress === autopilotTargetItem.userAddress) {
      //       return {
      //         ...item,
      //         distributed: isAutopilotDistributed,
      //       };
      //     }
      //     return item;
      //   });
      //   fs.writeFileSync(autopilotLogFilePath, JSON.stringify(newAutopilotDistributionItems, null, 2));
      // }
    }

    console.log('init swap volume distribution using 50% of total distribution amount');
    const { swapVolume } = data;
    const { result: swapVolumeResult } = swapVolume;

    const swapVolumeDistributionAmount = totalDistributionAmount * 0.5;

    const swapVolumeDistributionItems: AcsSignatureItem[] = swapVolumeResult
      .map((item: any) => ({
        userAddress: item.address,
        defiId: Number(process.env.ACS_SYNSTATION_DEFI_ID),
        acsAmount: Math.floor(swapVolumeDistributionAmount * item.ratio),
        description: `swap-volume-${epoch}`,
      }))
      .filter((item: AcsSignatureItem) => item.acsAmount > 0);
    const swapVolumeLogFilePath = `./acs-log/acs-points-distributed-${epoch}-swap-volume.json`;

    if (fs.existsSync(swapVolumeLogFilePath)) {
      console.log('Swap Volume Points distribution already exists');
    } else {
      const isSwapVolumeDistributed = await distributeAcsPoints(swapVolumeDistributionItems);
      if (isSwapVolumeDistributed) {
        fs.writeFileSync(swapVolumeLogFilePath, JSON.stringify(swapVolumeDistributionItems, null, 2));
        console.log('isSwapVolumeDistributed', isSwapVolumeDistributed);
      } else {
        console.error('failed to distribute swap volume points');
      }
    }
    //   for (const swapVolumeTargetItem of swapVolumeDistributionItems) {
    //     const isSwapVolumeDistributed = await distributeAcsPoints([
    //       {
    //         acsAmount: swapVolumeTargetItem.acsAmount,
    //         defiId: swapVolumeTargetItem.defiId,
    //         userAddress: swapVolumeTargetItem.userAddress,
    //         description: swapVolumeTargetItem.description,
    //       },
    //     ]);
    //     const newSwapVolumeDistributionItems = swapVolumeDistributionItems.map((item) => {
    //       if (item.userAddress === swapVolumeTargetItem.userAddress) {
    //         return {
    //           ...item,
    //           distributed: isSwapVolumeDistributed,
    //         };
    //       }
    //       return item;
    //     });
    //     fs.writeFileSync(swapVolumeLogFilePath, JSON.stringify(newSwapVolumeDistributionItems, null, 2));
    //   }
    // }

    console.log(
      'sum of swap volume and autopilot distributed amount',
      autopilotDistributionItems.reduce((acc, item) => acc + item.acsAmount, 0),
      swapVolumeDistributionItems.reduce((acc, item) => acc + item.acsAmount, 0)
    );
  } else {
    console.log('Execution cancelled.');
  }
}
