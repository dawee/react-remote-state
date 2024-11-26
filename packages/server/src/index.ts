import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

export { default as Server } from "./Server";
