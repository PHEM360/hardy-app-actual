#!/usr/bin/env node
/** Fill apple-app-site-association and assetlinks.json from native/store-identity.json. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const identity = JSON.parse(fs.readFileSync(path.join(root, "native/store-identity.json"), "utf8"));
const teamId = String(identity.appleTeamId || "").trim();
const fingerprints = Array.isArray(identity.androidSha256CertFingerprints)
  ? identity.androidSha256CertFingerprints.filter(Boolean)
  : [];

if (!teamId && fingerprints.length === 0) {
  console.log("Set appleTeamId and/or androidSha256CertFingerprints in native/store-identity.json first.");
  process.exit(0);
}

const dest = path.join(root, "public/.well-known");
fs.mkdirSync(dest, { recursive: true });

if (teamId) {
  const aasa = {
    applinks: {
      apps: [],
      details: [{ appID: `${teamId}.${identity.appId}`, paths: ["*"] }],
    },
    webcredentials: { apps: [`${teamId}.${identity.appId}`] },
  };
  fs.writeFileSync(path.join(dest, "apple-app-site-association"), `${JSON.stringify(aasa, null, 2)}\n`);
  console.log("Wrote public/.well-known/apple-app-site-association");
}

if (fingerprints.length) {
  const links = fingerprints.map((sha256) => ({
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: identity.appId,
      sha256_cert_fingerprints: [sha256],
    },
  }));
  fs.writeFileSync(path.join(dest, "assetlinks.json"), `${JSON.stringify(links, null, 2)}\n`);
  console.log("Wrote public/.well-known/assetlinks.json");
}
