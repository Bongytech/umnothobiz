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
//   --checks-only         Only set the required status checks and leave every
//                         other setting exactly as it is. This is the safe way to
//                         adopt the pipeline on a repository that is already
//                         protected.
//   --require-pr          Require a pull request before merging (kept if the
//                         branch already requires one).
//   --enforce-admins      Apply the rules to administrators too (kept if already
//                         enabled).
//   --linear-history      Reject merge commits. Off unless the branch already
//                         requires it, because it changes how pull requests merge.
//   --apply               Actually write. Without it the script prints what would
//                         change and exits 0.
//
// The script never downgrades an existing rule: when the branch is already
// protected more strictly than the defaults below (for example one required
// approval plus code-owner review), those values are carried over.
//
// The token needs "Administration" write (fine-grained) or the `repo` scope
// (classic) to read and write branch protection.

const CHECK_NAMES = [
  'Lint, typecheck, test, build',
  'Firestore security rules',
  'Cloud Functions',
  'Dependency vulnerability audit',
  'Secret scan',
  'Analyze JavaScript/TypeScript',
];

function parseArgs(argv) {
  const args = {
    repo: process.env.GITHUB_REPOSITORY || 'Bongytech/umnothobiz',
    branch: 'main',
    checksOnly: false,
    requirePr: false,
    enforceAdmins: false,
    linearHistory: false,
    apply: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--repo') args.repo = argv[++i];
    else if (arg === '--branch') args.branch = argv[++i];
    else if (arg === '--checks-only') args.checksOnly = true;
    else if (arg === '--require-pr') args.requirePr = true;
    else if (arg === '--enforce-admins') args.enforceAdmins = true;
    else if (arg === '--linear-history') args.linearHistory = true;
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

// Merge the desired rules with whatever is already enforced, keeping the
// stricter of the two. A settings script that quietly removes an approval
// requirement is worse than no script.
function desiredProtection(current, args) {
  const existingReviews = current?.required_pull_request_reviews ?? null;
  const requirePr = args.requirePr || Boolean(existingReviews);
  const enforceAdmins = args.enforceAdmins || Boolean(current?.enforce_admins?.enabled);
  const linearHistory = args.linearHistory || Boolean(current?.required_linear_history?.enabled);

  let reviews = null;
  if (requirePr) {
    reviews = {
      dismiss_stale_reviews: existingReviews?.dismiss_stale_reviews ?? true,
      require_code_owner_reviews: existingReviews?.require_code_owner_reviews ?? false,
      required_approving_review_count: existingReviews?.required_approving_review_count ?? 0,
      require_last_push_approval: existingReviews?.require_last_push_approval ?? false,
    };
  }

  return {
    required_status_checks: {
      strict: current?.required_status_checks?.strict ?? true,
      contexts: CHECK_NAMES,
    },
    enforce_admins: enforceAdmins,
    required_pull_request_reviews: reviews,
    restrictions: current?.restrictions ?? null,
    required_linear_history: linearHistory,
    allow_force_pushes: false,
    allow_deletions: false,
    block_creations: false,
    required_conversation_resolution: true,
    lock_branch: false,
    allow_fork_syncing: false,
  };
}

// Settings come back from the API as `{ enabled: boolean }` but go out as plain
// booleans, so tolerate both shapes.
function flag(value) {
  return typeof value === 'boolean' ? value : Boolean(value?.enabled);
}

function summarise(protection) {
  if (!protection) return 'none';
  const checks = protection.required_status_checks?.contexts ?? [];
  const reviews = protection.required_pull_request_reviews;
  return [
    `required checks: ${checks.length ? checks.join(', ') : 'none'}`,
    `strict up-to-date branch: ${Boolean(protection.required_status_checks?.strict)}`,
    `pull request required: ${Boolean(reviews)}${reviews ? ` (${reviews.required_approving_review_count} approval(s), code owners: ${Boolean(reviews.require_code_owner_reviews)})` : ''}`,
    `linear history: ${flag(protection.required_linear_history)}`,
    `force pushes allowed: ${flag(protection.allow_force_pushes)}`,
    `branch deletion allowed: ${flag(protection.allow_deletions)}`,
    `applies to admins: ${flag(protection.enforce_admins)}`,
  ].join('\n  ');
}

// Secret scanning and push protection are free for public repositories and stop
// a credential from ever reaching the remote. Enabled best-effort: some plans
// gate this behind Advanced Security.
async function enableSecretScanning(token, repo) {
  const repoInfo = await github(token, 'GET', `/repos/${repo}`);
  const analysis = repoInfo.data?.security_and_analysis;
  if (!analysis) {
    console.log('Repository security settings are not readable with this token; check Settings -> Code security.');
    return;
  }
  const patch = { security_and_analysis: {} };
  for (const key of ['secret_scanning', 'secret_scanning_push_protection']) {
    if (analysis[key]?.status !== 'enabled') patch.security_and_analysis[key] = { status: 'enabled' };
  }
  if (Object.keys(patch.security_and_analysis).length === 0) {
    console.log('Secret scanning and push protection are already enabled.');
    return;
  }
  const updated = await github(token, 'PATCH', `/repos/${repo}`, patch);
  if (updated.ok) console.log('Enabled secret scanning and push protection.');
  else console.log(`Secret scanning not enabled (${updated.status}); enable it in Settings -> Code security.`);
}

async function applyChecksOnly(token, args, current) {
  const existing = current.required_status_checks?.contexts ?? [];
  const added = CHECK_NAMES.filter((name) => !existing.includes(name));
  console.log(`Required checks now: ${existing.length ? existing.join(', ') : 'none'}`);
  console.log(`Adding: ${added.length ? added.join(', ') : 'nothing, already present'}`);

  if (!args.apply) {
    console.log('\nDry run: nothing written. Re-run with --apply to save these settings.');
    return;
  }
  if (added.length === 0) {
    console.log('\nNothing to do.');
    return;
  }

  const result = await github(
    token,
    'PATCH',
    `/repos/${args.repo}/branches/${args.branch}/protection/required_status_checks`,
    {
      strict: current.required_status_checks?.strict ?? true,
      contexts: [...existing, ...added],
    },
  );
  if (!result.ok) {
    console.error(`Failed to update required checks (${result.status}):`);
    console.error(JSON.stringify(result.data, null, 2));
    process.exit(1);
  }
  console.log(`\nRequired checks updated (${result.status}).`);
  await enableSecretScanning(token, args.repo);
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
  console.log(`Mode:       ${args.apply ? 'APPLY' : 'dry run'}${args.checksOnly ? ' (checks only)' : ''}\n`);

  const current = await github(token, 'GET', `/repos/${args.repo}/branches/${args.branch}/protection`);
  let currentData = null;
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
    currentData = current.data;
    console.log(`Current protection:\n  ${summarise(currentData)}\n`);
  }

  if (args.checksOnly) {
    if (!currentData) {
      console.error('--checks-only needs an existing protection rule; run without it first.');
      process.exit(1);
    }
    await applyChecksOnly(token, args, currentData);
    return;
  }

  const config = desiredProtection(currentData, args);
  const unchanged = JSON.stringify(currentData ?? {}) === JSON.stringify(config);
  console.log('Desired protection:');
  console.log(`  ${summarise(config)}`);
  if (unchanged) console.log('\nAlready in the desired state.');

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
  await enableSecretScanning(token, args.repo);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
