import {
  getMaturityRiskForecasts,
  getMaturityRiskPolicies,
} from "@/lib/server-data";

export async function GET() {
  const [forecasts, policies] = await Promise.all([
    getMaturityRiskForecasts(),
    getMaturityRiskPolicies(),
  ]);
  return Response.json({ forecasts, policies });
}
