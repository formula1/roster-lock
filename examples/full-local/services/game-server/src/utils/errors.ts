
export class HTTPError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public body?: any,
  ){
    super(message);
  }
}

