export type SocrataQueryParams = {
  select?: string;
  where?: string;
  group?: string;
  order?: string;
  limit?: number;
  offset?: number;
};

export class SocrataClient {
  readonly baseUrl: string;
  private readonly appToken: string | undefined;

  constructor(baseUrl: string, appToken?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.appToken = appToken;
  }

  buildUrl(datasetId: string, params: SocrataQueryParams = {}): string {
    const url = new URL(`${this.baseUrl}/${datasetId}.json`);
    if (params.select) url.searchParams.set("$select", params.select);
    if (params.where) url.searchParams.set("$where", params.where);
    if (params.group) url.searchParams.set("$group", params.group);
    if (params.order) url.searchParams.set("$order", params.order);
    if (params.limit !== undefined) url.searchParams.set("$limit", String(params.limit));
    if (params.offset !== undefined) url.searchParams.set("$offset", String(params.offset));
    return url.toString();
  }

  async query<T>(datasetId: string, params: SocrataQueryParams = {}): Promise<T[]> {
    const init: RequestInit = this.appToken ? { headers: { "X-App-Token": this.appToken } } : {};
    const response = await fetch(this.buildUrl(datasetId, params), init);
    if (!response.ok) {
      throw new Error(`Socrata request failed: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as T[];
  }
}
