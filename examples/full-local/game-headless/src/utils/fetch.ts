

export class HTTPError extends Error {
  constructor(
    public url: URL,
    public method: string,
    public response: Response,
    public body: any,
    message: string = `HTTP Error: ${response.status}`
  ){
    super(message);
  }
}
