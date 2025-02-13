import fs from 'fs';

const referralUrl = process.env.REFERRAL_URL as string;
const response = await fetch(referralUrl, {
  headers: {
    Authorization: `Bearer ${process.env.REFERRAL_API_KEY}`,
    apikey: process.env.REFERRAL_API_KEY,
  },
});
const data = await response.json();
console.log(data.length);

fs.writeFileSync(
  './result/referral-table.json',
  JSON.stringify(
    data.map((e) => ({ ...e, address: e.address.toLowerCase() })),
    null,
    2
  )
);
