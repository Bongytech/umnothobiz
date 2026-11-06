#!/usr/bin/env node
// Apply the repository's DevSecOps settings (branch protection and GitHub
// security features) from version control instead of clicking through settings.
//
//   GITHUB_TOKEN=... node scripts/ops/apply-branch-protection.mjs [options]
//
// Options:
//   --repo <owner/name>   Target repository. Defaults to GITHUB_REPOSITORY,
//                         then to Bongytech/umnothobiz.
//   --branch <name>       Protected branch. Defaults to main.
//   --require-pr          Also require a pull request before merging.
//   --enforce-admins      Apply the rules to administrators too.
//   --apply               Actually write. Without it the script prints a diff
//                         and exits 0.
//
// The token needs "Administration" write (fine-grained) or the `repo` scope
// (classic) to read and write branch protection.

const CHECK_NAMES = [
  'Lint, typecheck, test, build',
  'Firestore security rules',
  'Cloud Functions',
  'Dependency vulnerability audit',
  'Secret scan',
  'Dependency review',
  'Analyze JavaScript/TypeScript',
];

function parseArgs(argv) {
  const args = {
    repo: process.env.GITHUB_REPOSITORY || 'Bongytech/umnothobiz',
    branch: 'main',
    requirePr: false,
    enforceAdmins: false,
    apply: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--repo') args.repo = argv[++i];
    else if (arg === '--branch') args.branch = argv[++i];
    else if (arg === '--require-pr') args.requirePr = true;
    else if (arg === '--enforce-admins') args.enforceAdmins = true;
    else if (arg === '--apply') args.apply = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('See the header of this file for usage.');
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  return args;
}

async function github(token, method, path, body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'umnotho-devops',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: response.status, ok: response.ok, data };
}

function desiredProtection({ requirePr, enforceAdmins }) {
  return {
    required_status_checks: {
      strict: true,
      contexts: CHECK_NAMES,
    },
    enforce_admins: enforceAdmins,
    required_pull_request_reviews: requirePr
      ? {
          dismiss_stale_reviews: true,
          require_code_owner_reviews: false,
          required_approving_review_count: 0,
        }
      : null,
    restrictions: null,
    required_linear_history: true,
    allow_force_pushes: false,
    allow_deletions: false,
    block_creations: false,
    required_conversation_resolution: true,
    lock_branch: false,
    allow_fork_syncing: false,
  };
}

function summarise(protection) {
  if (!protection) return 'none';
  const checks = protection.required_status_checks?.contexts ?? [];
  return [
    `required checks: ${checks.length ? checks.join(', ') : 'none'}`,
    `strict up-to-date branch: ${Boolean(protection.required_status_checks?.strict)}`,
    `pull request required: ${Boolean(protection.required_pull_request_reviews)}`,
    `force pushes allowed: ${Boolean(protection.allow_force_pushes?.enabled)}`,
    `branch deletion allowed: ${Boolean(protection.allow_deletions?.enabled)}`,
    `applies to admins: ${Boolean(protection.enforce_admins?.enabled)}`,
  ].join('\n  ');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    console.error('GITHUB_TOKEN (or GH_TOKEN) is required.');
    process.exit(2);
  }

  console.log(`Repository: ${args.repo}`);
  console.log(`Branch:     ${args.branch}`);
  console.log(`Mode:       ${args.apply ? 'APPLY' : 'dry run'}\n`);

  const current = await github(token, 'GET', `/repos/${args.repo}/branches/${args.branch}/protection`);
  if (current.status === 404) {
    console.log('Current protection: none');
  } else if (current.status === 403) {
    console.error('This token cannot manage branch protection (403).');
    console.error('The script needs a token with Administration: write (fine-grained) or the');
    console.error('`repo` scope (classic). A token used for normal pushes is not enough.');
    console.error('Ask the repository owner to run it, or configure the settings in the UI.');
    process.exit(1);
  } else if (!current.ok) {
    console.error(`Cannot read branch protection (${current.status}): ${JSON.stringify(current.data)}`);
    process.exit(1);
  } else {
    console.log(`Current protection:\n  ${summarise(current.data)}\n`);
  }

  const config = desiredProtection(args);
  console.log('Desired protection:');
  console.log(`  ${summarise({
    required_status_checks: { strict: true, contexts: CHECK_NAMES },
    required_pull_request_reviews: config.required_pull_request_reviews,
    allow_force_pushes: { enabled: false },
    allow_deletions: { enabled: false },
    enforce_admins: { enabled: config.enforce_admins },
  })}`);
  for (const check of CHECK_NAMES) console.log(`    - ${check}`);

  if (!args.apply) {
    console.log('\nDry run: nothing written. Re-run with --apply to save these settings.');
    return;
  }

  const result = await github(
    token,
    'PUT',
    `/repos/${args.repo}/branches/${args.branch}/protection`,
    config,
  );
  if (!result.ok) {
    console.error(`Failed to apply branch protection (${result.status}):`);
    console.error(JSON.stringify(result.data, null, 2));
    console.error('\nThe token needs admin rights on the repository. On a plan without');
    console.error('protected-branch support, configure these settings in the UI instead.');
    process.exit(1);
  }
  console.log('\nBranch protection applied.');

  // Secret scanning and push protection are free for public repositories and
  // stop a credential from ever reaching the remote. Enabled best-effort: some
  // plans gate this behind Advanced Security.
  const repoInfo = await github(token, 'GET', `/repos/${args.repo}`);
  const analysis = repoInfo.data?.security_and_analysis;
  if (analysis) {
    const patch = { security_and_analysis: {} };
    for (const key of ['secret_scanning', 'secret_scanning_push_protection']) {
      if (analysis[key]?.status !== 'enabled') patch.security_and_analysis[key] = { status: 'enabled' };
    }
    if (Object.keys(patch.security_and_analysis).length > 0) {
      const updated = await github(token, 'PATCH', `/repos/${args.repo}`, patch);
      if (updated.ok) console.log('Enabled secret scanning and push protection.');
      else console.log(`Secret scanning not enabled (${updated.status}); enable it in Settings -> Code security.`);
    } else {
      console.log('Secret scanning and push protection are already enabled.');
    }
  } else {
    console.log('Repository security settings are not readable with this token; check Settings -> Code security.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
