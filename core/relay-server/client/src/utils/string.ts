

export function replaceAll(str: string, search: string, replacement: string){
  const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string

  // Create a new global RegExp object and use replace()
  const regex = new RegExp(escapedSearch, 'g');
  return str.replace(regex, replacement);
}
