
export function eachSeries<T>(
  values: Array<T>,
  iterator: (value: T, next: (err?: any)=>void)=>void,
  finishedCB: (err?: any)=>void
){
  let index = 0;
  function next(err?: any){
    if(err) return finishedCB(err);
    if(index >= values.length) return finishedCB();
    iterator(values[index++], next);
  }
  next();
}