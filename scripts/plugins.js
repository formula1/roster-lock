#!/usr/local/bin/node

const { readdir, readFile, stat: fsStat } = require("fs").promises;
const { resolve: pathResolve, join: pathJoin } = require("path");

const __root = pathResolve(__dirname, "..");
const pluginManager = require(pathJoin(__root, "./core/plugin-runtime"));

Promise.resolve().then(async ()=>{
  const updatePromises = [];

  await Promise.all(process.argv.slice(2).map(async (arg)=>{
    const directoryPath = pathResolve(process.cwd(), arg);
    for await (const pluginePath of findPackagesInFolder(directoryPath)){
      const pluginPackagePath = pathJoin(pluginePath, "package.json");
      const pluginPackage = JSON.parse(await readFile(pluginPackagePath, "utf8"));
      if(typeof pluginPackage.name !== "string"){
        throw new Error(pluginePath + " package.json doesn't have `name`");
      }
      if(!pluginPackage["roster-lock"]){
        console.warn(pluginePath, "has no roster-lock config");
        continue;
      }
      if(!("pluginType" in pluginPackage["roster-lock"])){
        console.warn(pluginePath, "has no roster-lock pluginType");
        continue;
      }

      updatePromises.push(Promise.resolve().then(async ()=>{
        console.log("starting plugin update:", pluginePath, pluginPackage.name);
        await pluginManager.updatePlugin(
          pluginManager.DEFAULT_PLUGIN_DIR, pluginPackage.name
        );
        console.log("finished plugin update:", pluginePath, pluginPackage.name);
      }));
    }
  }));

  await Promise.all(updatePromises);
}).catch((e)=>{
  console.error("Failure:", e);
});

async function* findPackagesInFolder(folderPath){
  const stat = await fsStat(folderPath);
  if(!stat.isDirectory()) return;

  const pluginPackagePath = pathJoin(folderPath, "package.json");
  if(await fsExists(pluginPackagePath) === "file"){
    yield folderPath;
    return;
  }
  for(const plugin of await readdir(folderPath)){
    yield* await findPackagesInFolder(pathJoin(folderPath, plugin));
  }
}

async function fsExists(path){
  try {
    const stat = await fsStat(path);
    if(stat.isDirectory()) return "dir";
    return "file";
  }catch(e){
    return null;
  }
}
