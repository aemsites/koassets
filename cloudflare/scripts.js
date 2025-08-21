#!/usr/bin/env node

import { execSync, spawn, spawnSync } from 'node:child_process';

function shell(cmd, args) {
  return spawnSync(cmd, args, {
    env: { ...process.env, FORCE_COLOR: '1' },
    stdio: 'inherit',
  });
}

function getBranch() {
  return execSync('git branch --show-current').toString().trim();
}

function getLastCommitMessage() {
  return execSync('git log -1 --pretty=%B').toString().trim();
}

function directoryHasLocalChanges() {
  try {
    execSync('git diff --quiet .');
    return false;
  } catch (_e) {
    return true;
  }
}

function uploadVersion(args) {
  return new Promise((resolve) => {
    let versionId;
    const child = spawn('npx', ['wrangler', 'versions', 'upload', ...args], {
      env: { ...process.env, FORCE_COLOR: '1' },
    });
    child.stdout.on('data', (data) => {
      const match = data.toString().match(/Worker Version ID: (\S+)/);
      if (match) {
        versionId = match[1];
      }
      console.log(data.toString());
    });
    child.stderr.on('data', (data) => {
      console.error(data.toString());
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(versionId);
      } else {
        process.exit(code);
      }
    });
  });
}

class Commands {
  async deploy(args) {
    const branch = getBranch();
    console.log('Deploying branch:', branch);

    // biome-ignore format: the array should not be formatted
    const versionId = await uploadVersion([
      '--preview-alias', branch,
      '--tag', branch,
      '--message', directoryHasLocalChanges() ?  '<local changes>' : getLastCommitMessage(),
      '--var', `HELIX_ORIGIN_HOSTNAME:${branch}--koassets--aemsites.aem.live`
    ]);

    if (args[0] === '--tail') {
      shell('npx', ['wrangler', 'tail', '--version-id', versionId]);
    }
  }

  async deployProd() {
    const branch = getBranch();
    console.log(`Deploying ${branch} to production worker`);

    // biome-ignore format: the array should not be formatted
    const versionId = await uploadVersion([
      '--tag', branch,
      '--message', directoryHasLocalChanges() ?  '<local changes>' : getLastCommitMessage(),
    ]);

    shell('npx', ['wrangler', 'versions', 'deploy', '-y', versionId]);
  }
}

const commands = new Commands();

const cmd = process.argv[2];
if (commands[cmd]) {
  commands[cmd](process.argv.slice(3));
} else {
  console.error('Unknown command:', cmd);
  process.exit(1);
}
