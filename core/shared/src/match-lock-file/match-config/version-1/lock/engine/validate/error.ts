

export class ValidationErrorPath extends Error {
  path = "/";
  constructor(message: string){
    super(message);
  }
  addPathPrefix(part: string){
    this.path = `/${part}${this.path}`;
  }
  addPathSuffix(part: string){
    this.path = `${this.path}/${part}`;
  }
  static convertError(e: unknown){
    if(!(e instanceof Error)) throw e;
    if(!(e instanceof ValidationErrorPath)){
      e = new ValidationErrorPath(e.message);
    }
    return e as ValidationErrorPath;
  }
}
