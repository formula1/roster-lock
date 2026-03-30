

export async function handleFetch<T>(result: ReturnType<typeof fetch>){
  const response = await result;
  const json = await response.json();
  if(!response.ok) {
    throw new FetchError(response, json);
  }
  return json as T;
}

export class FetchError extends Error {
  public url: URL
  public statusCode: number;
  constructor(
    public response: Response,
    public body: any,
    message: string = `HTTP Error: ${response.status}`
  ){
    super(message);
    this.url = new URL(response.url);
    this.statusCode = response.status;
  }
}
