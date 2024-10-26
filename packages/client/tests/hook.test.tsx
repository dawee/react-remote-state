import { expect, test, beforeEach, afterEach, assert } from "vitest";
import { Server } from "@react-remote-state/server";
import { io as ioc, type Socket as Client } from "socket.io-client";
import { render, screen, fireEvent } from "@testing-library/react";

test("foo", () => {
  function ComponentTest() {
    console.log("component");
    return <div></div>;
  }

  render(<ComponentTest />);
});
