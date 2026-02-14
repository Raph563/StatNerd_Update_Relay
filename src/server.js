#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const HOST = '127.0.0.1';
const PORT = Number(process.env.STATNERD_RELAY_PORT || 17863);
const MAX_BODY = 64 * 1024;
const RUN_TIMEOUT_MS = 20 * 60 * 1000;

let running = false;

function writeJson(res, code, payload) {
  const body = JSON.stringify(payload || {});
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function normalizeRepository(value) {
  const text = String(value || '')
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');
  const parts = text.split('/').filter(Boolean);
  if (parts.length < 2) return '';
  const owner = parts[0];
  const repo = parts[1];
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) return '';
  return `${owner}/${repo}`;
}

function normalizeReleaseTag(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.startsWith('v') ? raw : `v${raw}`;
}

function ensureInsideRoot(root, candidate) {
  const rootResolved = path.resolve(root);
  const candidateResolved = path.resolve(candidate);
  const rel = path.relative(rootResolved, candidateResolved);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function buildPaths(localRootPath) {
  const root = path.resolve(String(localRootPath || '').trim());
  if (!root || !fs.existsSync(root)) throw new Error(`Local root not found: ${localRootPath}`);
  const scriptsDir = path.join(root, 'addon', 'scripts');
  const configDir = path.join(root, 'config');
  const dataDir = path.join(configDir, 'data');
  if (!ensureInsideRoot(root, scriptsDir) || !ensureInsideRoot(root, configDir)) {
    throw new Error('Invalid local root path.');
  }
  if (!fs.existsSync(scriptsDir)) throw new Error(`Scripts directory not found: ${scriptsDir}`);
  if (!fs.existsSync(dataDir)) throw new Error(`Config data directory not found: ${dataDir}`);
  return {
    root,
    scriptsDir,
    configDir,
    dataDir,
    stateFile: path.join(dataDir, 'grocy-addon-state.json'),
  };
}

function buildCommand(platform, input, paths) {
  const repo = input.repository;
  const tag = input.releaseTag || '';
  const includePrerelease = input.includePrerelease === true;
  const noBackup = input.noBackup === true;

  if (platform === 'win32') {
    const script = path.join(paths.scriptsDir, 'update-from-github.ps1');
    if (!fs.existsSync(script)) throw new Error(`Script not found: ${script}`);
    const args = [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      script,
      '-Repository',
      repo,
      '-GrocyConfigPath',
      paths.configDir,
    ];
    if (tag) args.push('-ReleaseTag', tag);
    if (includePrerelease) args.push('-AllowPrerelease');
    if (noBackup) args.push('-NoBackup');
    return {
      file: 'powershell',
      args,
      cwd: paths.scriptsDir,
    };
  }

  const script = path.join(paths.scriptsDir, 'update-from-github.sh');
  if (!fs.existsSync(script)) throw new Error(`Script not found: ${script}`);
  const args = [
    script,
    '--repository',
    repo,
    '--config',
    paths.configDir,
  ];
  if (tag) args.push('--tag', tag);
  if (includePrerelease) args.push('--allow-prerelease');
  if (noBackup) args.push('--no-backup');
  return {
    file: '/bin/sh',
    args,
    cwd: paths.scriptsDir,
  };
}

function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd.file, cmd.args, {
      cwd: cmd.cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill('SIGKILL'); } catch (_err) {}
      reject(new Error(`Update timeout after ${Math.floor(RUN_TIMEOUT_MS / 1000)}s`));
    }, RUN_TIMEOUT_MS);
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
      if (stdout.length > 20000) stdout = stdout.slice(-20000);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
      if (stderr.length > 20000) stderr = stderr.slice(-20000);
    });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: Number(code) || 0, stdout, stderr });
    });
  });
}

function readInstalledTag(stateFile, fallbackTag) {
  try {
    if (!fs.existsSync(stateFile)) return fallbackTag || '';
    const payload = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    const tag = normalizeReleaseTag(payload && payload.release_tag ? payload.release_tag : '');
    return tag || (fallbackTag || '');
  } catch (_err) {
    return fallbackTag || '';
  }
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk.toString('utf8');
      if (raw.length > MAX_BODY) {
        reject(new Error('Payload too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (_err) {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    writeJson(res, 204, { ok: true });
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    writeJson(res, 200, {
      ok: true,
      app: 'statnerd-relay',
      platform: os.platform(),
      port: PORT,
      running,
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/v1/update') {
    if (running) {
      writeJson(res, 409, { ok: false, error: 'Update already running.' });
      return;
    }
    try {
      const input = await parseJsonBody(req);
      const repository = normalizeRepository(input.repository || '');
      if (!repository) {
        writeJson(res, 400, { ok: false, error: 'Invalid repository (expected owner/repo).' });
        return;
      }
      const localRootPath = String(input.localRootPath || '').trim();
      if (!localRootPath) {
        writeJson(res, 400, { ok: false, error: 'localRootPath is required.' });
        return;
      }
      const releaseTag = normalizeReleaseTag(input.releaseTag || '');
      const paths = buildPaths(localRootPath);
      const cmd = buildCommand(process.platform, {
        repository,
        releaseTag,
        includePrerelease: input.includePrerelease === true,
        noBackup: input.noBackup === true,
      }, paths);

      running = true;
      const result = await runCommand(cmd);
      if (result.code !== 0) {
        writeJson(res, 500, {
          ok: false,
          error: `Update script failed (exit ${result.code}).`,
          stdout: result.stdout,
          stderr: result.stderr,
        });
        return;
      }
      const installedTag = readInstalledTag(paths.stateFile, releaseTag);
      writeJson(res, 200, {
        ok: true,
        installedTag,
        stdout: result.stdout,
        stderr: result.stderr,
      });
      return;
    } catch (err) {
      writeJson(res, 500, {
        ok: false,
        error: (err && err.message) ? err.message : String(err),
      });
      return;
    } finally {
      running = false;
    }
  }

  writeJson(res, 404, { ok: false, error: 'Not found.' });
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`[StatNerd Relay] listening on http://${HOST}:${PORT}\n`);
});
