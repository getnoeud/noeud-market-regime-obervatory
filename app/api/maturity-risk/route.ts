import {
  getMaturityRiskBenchmarks,
  getMaturityRiskForecasts,
  getMaturityRiskPolicies,
} from "@/lib/server-data";

export async function GET() {
  const [forecasts, benchmarks, policies] = await Promise.all([
    getMaturityRiskForecasts(),
    getMaturityRiskBenchmarks(),
    getMaturityRiskPolicies(),
  ]);
  return Response.json({ forecasts, benchmarks, policies });
}
