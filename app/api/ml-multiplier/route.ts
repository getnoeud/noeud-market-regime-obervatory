import {
  getMLMultiplierBenchmarks,
  getMLMultiplierModels,
  getMLMultiplierPredictions,
} from "@/lib/server-data";

export async function GET() {
  const [models, predictions, benchmarks] = await Promise.all([
    getMLMultiplierModels(),
    getMLMultiplierPredictions(),
    getMLMultiplierBenchmarks(),
  ]);
  return Response.json({ models, predictions, benchmarks });
}
