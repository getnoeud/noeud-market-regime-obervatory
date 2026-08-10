import {
  getMaturityRiskBenchmarks,
  getOperationalMaturityRiskForecasts,
} from "@/lib/server-data";

export async function GET() {
  const [forecasts, benchmarks] = await Promise.all([
    getOperationalMaturityRiskForecasts(),
    getMaturityRiskBenchmarks(),
  ]);
  return Response.json({ forecasts, benchmarks });
}
