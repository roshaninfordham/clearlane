export class MtaBusTimeClient {
  private readonly apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async health(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const url = new URL("https://bustime.mta.info/api/siri/vehicle-monitoring.json");
      url.searchParams.set("key", this.apiKey);
      url.searchParams.set("MaximumNumberOfCallsOnwards", "1");
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      return response.ok;
    } catch {
      return false;
    }
  }
}
