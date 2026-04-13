
export const PATH_VARIABLE_VALUE_VALIDATION = {
  minLength: 1,
  maxLength: 64,
  charset: 'a-zA-Z0-9_\\- ',
};

export function validatePathVariablesInGlob(
  glob: string, pathVariables: Array<string>
){
  const pathVariableRegex = /<([a-zA-Z0-9_\\-]+)>/g;
  let match: RegExpExecArray | null;
  while((match = pathVariableRegex.exec(glob)) !== null){
    const variable = match[1];
    if(!pathVariables.includes(variable)){
      throw new Error(`Glob ${glob} uses undefined path variable ${variable}`);
    }
  }
}

export function replacePathVariablesWithGlob(
  glob: string
){
  return glob.replaceAll(
    /<([a-zA-Z0-9_\\-]+)>/g,
    `[[${PATH_VARIABLE_VALUE_VALIDATION.charset}]+]{${PATH_VARIABLE_VALUE_VALIDATION.minLength},${PATH_VARIABLE_VALUE_VALIDATION.maxLength}}`
  );
}
