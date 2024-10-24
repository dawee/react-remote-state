import { expect, test } from "vitest";
import Server from "../src/Server";

test("start callback is called", () =>
  new Promise<void>((done) => {
    let server = new Server();

    server.start(() => done());
  }));
