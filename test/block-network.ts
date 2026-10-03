import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { syncBuiltinESMExports } from "node:module";

// This setup belongs only to the gate regression. Even a broken gate cannot
// make a real provider/deployment HTTP call while we verify default-off behavior.
function rejectNetwork(): never {
  throw new Error("Network access is forbidden in the offline gate regression");
}

globalThis.fetch = rejectNetwork;

http.request = rejectNetwork;

http.get = rejectNetwork;

https.request = rejectNetwork;

https.get = rejectNetwork;

net.Socket.prototype.connect = rejectNetwork;

tls.connect = rejectNetwork;

syncBuiltinESMExports();
