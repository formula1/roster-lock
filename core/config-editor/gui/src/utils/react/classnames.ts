
export function combineClassNames(...classNames: Array<string | null | undefined>){
  const allClasses = [];
  for(const className of classNames){
    if(!className) continue;
    for(const split of className.split(' ')){
      if(!split) continue;
      allClasses.push(split);
    }
  }
  return classNames.join(' ');
}
