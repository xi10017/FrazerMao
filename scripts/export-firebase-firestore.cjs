#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { configstore } = require('/usr/local/lib/node_modules/firebase-tools/lib/configstore');
const { getAccessToken } = require('/usr/local/lib/node_modules/firebase-tools/lib/auth');

const projectId = process.argv[2];
const outputPath = process.argv[3];

if (!projectId || !outputPath) {
  console.error('Usage: node scripts/export-firebase-firestore.cjs <project-id> <output-json>');
  process.exit(1);
}

const firestoreRoot = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;

function encodePath(value) {
  return value.split('/').map(encodeURIComponent).join('/');
}

async function getAuthHeader() {
  const tokens = configstore.get('tokens') || {};
  if (!tokens.refresh_token && !tokens.access_token) {
    throw new Error('Firebase CLI is not logged in. Run firebase login first.');
  }

  const token = await getAccessToken(tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
  if (!token || !token.access_token) {
    throw new Error('Unable to obtain a Firebase access token.');
  }
  return { Authorization: `Bearer ${token.access_token}` };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(await getAuthHeader()),
    },
    signal: AbortSignal.timeout(30_000),
  });

  const body = await response.text();
  let parsed;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    parsed = body;
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(parsed)}`);
  }
  return parsed;
}

async function listCollectionIds(parentPath) {
  const suffix = parentPath ? `/${encodePath(parentPath)}` : '';
  const result = await requestJson(`${firestoreRoot}${suffix}:listCollectionIds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pageSize: 300 }),
  });

  return result.collectionIds || [];
}

async function listDocuments(collectionPath) {
  const documents = [];
  let pageToken;

  do {
    const query = new URLSearchParams({ pageSize: '300', showMissing: 'false' });
    if (pageToken) query.set('pageToken', pageToken);

    const result = await requestJson(`${firestoreRoot}/${encodePath(collectionPath)}?${query}`);
    documents.push(...(result.documents || []));
    pageToken = result.nextPageToken;
  } while (pageToken);

  return documents;
}

async function walkCollection(collectionPath, output) {
  const documents = await listDocuments(collectionPath);

  for (const document of documents) {
    const documentPath = document.name.split('/documents/')[1];
    output.push({ path: documentPath, document });

    const subcollections = await listCollectionIds(documentPath);
    for (const subcollection of subcollections) {
      await walkCollection(`${documentPath}/${subcollection}`, output);
    }
  }
}

async function main() {
  const topLevelCollections = await listCollectionIds('');
  const documents = [];

  for (const collection of topLevelCollections) {
    await walkCollection(collection, documents);
    console.error(`Exported ${collection}`);
  }

  const resolvedOutput = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  fs.writeFileSync(
    resolvedOutput,
    JSON.stringify({
      projectId,
      exportedAt: new Date().toISOString(),
      documents,
    }, null, 2),
    { mode: 0o600 },
  );

  console.log(`Exported ${documents.length} Firestore documents to ${resolvedOutput}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
