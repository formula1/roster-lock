

export class RunUntrustedError extends Error {
  constructor(
    public scriptSrc: string, message: string, public error: any
  ){
    super(message)
  }
}
