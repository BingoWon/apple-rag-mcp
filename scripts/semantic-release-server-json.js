/**
 * Custom Semantic-Release plugin to update server.json version
 */

import fs from 'fs';
import path from 'path';

function updateServerJson(pluginConfig, context) {
  const { nextRelease, logger } = context;
  const serverJsonPath = path.resolve(process.cwd(), 'server.json');

  if (!fs.existsSync(serverJsonPath)) {
    logger.log('server.json not found, skipping version update');
    return;
  }

  try {
    const serverJson = JSON.parse(fs.readFileSync(serverJsonPath, 'utf8'));
    serverJson.version = nextRelease.version;

    fs.writeFileSync(serverJsonPath, JSON.stringify(serverJson, null, 2) + '\n');
    logger.log(`Updated server.json version to ${nextRelease.version}`);
  } catch (error) {
    logger.error('Failed to update server.json:', error);
    throw error;
  }
}

export default {
  prepare: updateServerJson
};
