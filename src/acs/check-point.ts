const acsBaseUrl = process.env.ACS_BASE_URL;
const acsSynstationDefiId = process.env.ACS_SYNSTATION_DEFI_ID;
if (!acsBaseUrl || !acsSynstationDefiId) {
  throw new Error('ACS_BASE_URL or ACS_SYNSTATION_DEFI_ID is not set');
}

// QUERY GRAPHQL

const query = `
query ExampleQuery($defiId: Int!) {
  getDefiPointInfoByDefiId(defiId: $defiId) {
    dailyPoints
    defiId
    defiName
    remainingPoints
    totalReceivedPoints
  }
}
`;

export async function getPointInfo() {
  const response = await fetch(`https://acs-graphql.astar.network/graphql`, {
    method: 'POST',
    body: JSON.stringify({ query, variables: { defiId: Number(acsSynstationDefiId) } }),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  console.log(data);
  return data;
}
