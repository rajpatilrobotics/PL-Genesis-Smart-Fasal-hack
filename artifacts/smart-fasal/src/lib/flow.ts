import * as fcl from "@onflow/fcl";

fcl.config({
  "flow.network": "testnet",
  "accessNode.api": "https://rest-testnet.onflow.org",
  "discovery.wallet": "https://fcl-discovery.onflow.org/testnet/authn",
  "app.detail.title": "Smart Fasal",
  "app.detail.icon": "https://i.imgur.com/YaHeILZ.png",
});

export { fcl };
