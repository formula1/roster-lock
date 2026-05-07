#!/bin/node

const { join: pathJoin, resolve: pathResolve } = require("path");
const { existsSync } = require("fs");
const { readFile } = require("fs").promises;
const { spawn } = require("child_process");

Promise.resolve().then(async ()=>{
  const dependencyMap = new Map();
  await Promise.all(process.argv.slice(2).map((arg)=>{
    const initialDirectory = pathResolve(process.cwd(), arg);
    return fillDependencyMap(dependencyMap, initialDirectory);
  }));

  const sortedPackages = sortDependencyTree(
    new Map(dependencyMap)
  );

  for(const packageDirs of sortedPackages){
    console.log("Running in Parrallel:", packageDirs);
    await Promise.all(packageDirs.map(async (packageDir)=>{
      await execWithStdIo("npm install", { cwd: packageDir });
      // await execWithStdIo("npm run prepare", { cwd: packageDir });
    }));
  }
}).catch((e)=>{
  console.error("Failure:", e);
});

/* Pseudo Code
get the dependencies of the initial package
- if that package doesn't have dependency, we're good
- for each dependency
  - get the dependencies of the dependency
    - if there are no

*/

async function fillDependencyMap(dependencyMap, initialDirectory){
  dependencyMap.set(initialDirectory, null);
  const deps = await getDependenciesOfPackage(initialDirectory);
  dependencyMap.set(initialDirectory, deps);

  await Promise.all(deps.map((dep)=>{
    if(dependencyMap.has(dep)) return;
    return fillDependencyMap(dependencyMap, dep);
  }));
}

/*
const deps = new Map()
deps.set("hello", ["world", "!"])
deps.set("item2", ["3", "4", "5"])
deps.set("mote", ["more", "spell", "check"])
console.error(Object.fromEntries(deps.entries()))
*/

function sortDependencyTree(dependencyMap){
  const sorted = [];
  const handled = new Set();
  while(dependencyMap.size > 0){
    const activeList = [];
    for(const [filePath, deps] of dependencyMap.entries()){
      let canAdd = true;
      for(const dep of deps){
        if(!handled.has(dep)){
          canAdd = false;
          break;
        }
      }
      if(canAdd){
        activeList.push(filePath);
        dependencyMap.delete(filePath);
      }
    }
    if(activeList.length === 0){
      console.error(Object.fromEntries(dependencyMap.entries()));
      throw new Error("Dependency tree not resolvable");
    }
    sorted.push(activeList);
    for(const filePath of activeList){
      handled.add(filePath);
    }
  }
  return sorted;
}


const PATH_PREFIX = "file:";

async function getDependenciesOfPackage(dir){
  const packageFilePath = pathJoin(dir, "package.json");
  if(!existsSync(packageFilePath)){
    throw new Error("Nonexistant package: " + packageFilePath);
  }
  const packageJSON = JSON.parse(await readFile(packageFilePath, "utf8"));

  const dependencies = [];

  for(const version of Object.values(packageJSON.dependencies || {})){
    if(isFileSystemPath(version)){
      dependencies.push(pathResolve(dir, version.slice(PATH_PREFIX.length)));
    }
  }
  for(const version of Object.values(packageJSON.devDependencies || {})){
    if(isFileSystemPath(version)){
      dependencies.push(pathResolve(dir, version.slice(PATH_PREFIX.length)));
    }
  }

  return dependencies;
}

function isFileSystemPath(version){
  // Only accept relative paths starting with ../ or ./
  // Reject absolute paths, URLs, git+, tarballs, and registry references
  if(!version.startsWith(PATH_PREFIX)){
    debug(false, "Not File System", version);
    return false;
  }
  if(/\.(tar|tgz|gz)$/.test(version)){
    debug(false, "Archive", version);
    return false;
  }
  return true;
};

function debug(...args){
  if(process.env.DEBUG) console.log(...args);
}


function execWithStdIo(command, { cwd }){
  return new Promise((resolve, reject)=>{
    const io = [];
    const [cmd, ...args] = command.split(" ");
    const newProcess = spawn(cmd, args, { cwd });

    newProcess.stdout.on("data", (data)=>{
      io.push(data.toString());
    });

    newProcess.stderr.on("data", (data)=>{
      io.push(data.toString());
    });

    newProcess.on("exit", (code) => {
      if(code === 0) return resolve();

      console.log(`\x1b[1;31m${"=".repeat(10)}\x1b[0m`);
      console.log(`\x1b[1;31m${cwd}: ${command}\x1b[0m`);
      console.log(`\x1b[1;31m${"=".repeat(10)}\x1b[0m`);
      console.log(io.join(""));
      reject(code);
    });
  });
}
