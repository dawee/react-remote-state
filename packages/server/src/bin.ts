import Server from "./Server";
import { program } from "commander";

program.option("--port", "Port to listen to", "3000");

program.parse();

let options = program.opts();

console.log("wat");
