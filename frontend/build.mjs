import {build} from "esbuild"
import {execFileSync} from "node:child_process"
import {mkdirSync} from "node:fs"
mkdirSync("assets",{recursive:true})
execFileSync(process.execPath,["node_modules/typescript/bin/tsc"],{stdio:"inherit"})
execFileSync(process.execPath,["node_modules/tailwindcss/lib/cli.js","-i","src/style.css","-o","assets/workspace.css","--minify"],{stdio:"inherit"})
await build({entryPoints:["src/workspace.tsx"],bundle:true,format:"esm",minify:true,define:{"process.env.NODE_ENV":'"production"'},outfile:"assets/workspace.js"})
