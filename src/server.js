#!/usr/bin/env node
'use strict';

const { createRelayServer } = require('./relay-server');

const relay = createRelayServer({ port: process.env.STATNERD_RELAY_PORT });

relay.start()
  .then(() => {
    const status = relay.status();
    process.stdout.write(`[StatNerd Relay] listening on http://${status.host}:${status.port}\n`);
  })
  .catch((err) => {
    process.stderr.write(`[StatNerd Relay] startup failed: ${(err && err.message) ? err.message : String(err)}\n`);
    process.exitCode = 1;
  });
