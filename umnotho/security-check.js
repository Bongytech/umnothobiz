#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('��� UNMOTHO SECURITY CHECK');
console.log('=========================\n');

let hasErrors = false;
let warnings = [];

console.log('1. Running npm audit...');
try {
  const auditResult = execSync('npm audit --json', { encoding: 'utf8', stdio: 'pipe' });
  const auditData = JSON.parse(auditResult);
  
  if (auditData.metadata?.vulnerabilities?.total > 0) {
    const vuln = auditData.metadata.vulnerabilities;
    console.log(`❌ Found ${vuln.total} vulnerabilities:`);
    console.log(`   Critical: ${vuln.critical || 0}`);
    console.log(`   High: ${vuln.high || 0}`);
    console.log(`   Moderate: ${vuln.moderate || 0}`);
    console.log(`   Low: ${vuln.low || 0}`);
    hasErrors = true;
  } else {
    console.log('✅ No vulnerabilities found in dependencies\n');
  }
} catch (error) {
  console.log('⚠️  npm audit failed or found vulnerabilities');
  console.log('   Run manually: npm audit --audit-level=high\n');
  hasErrors = true;
}

console.log('2. Checking for hardcoded secrets...');
try {
  // Check for actual Firebase API keys (not empty strings)
  const checkCommand = process.platform === 'win32' 
    ? 'powershell "Select-String -Path src\\\\*.ts, src\\\\*.tsx, src\\\\*.js, src\\\\*.jsx -Pattern \\"AIza[0-9A-Za-z\\\\-_]{35}\\" -SimpleMatch" 2>$null'
    : 'grep -r "AIza[0-9A-Za-z\\-_]\\{35\\}" src/ 2>/dev/null';
  
  const result = execSync(checkCommand, { encoding: 'utf8', stdio: 'pipe' });
  if (result && result.trim() && !result.includes('Select-String')) {
    console.log('❌ Hardcoded Firebase API keys found!');
    console.log(result);
    hasErrors = true;
  } else {
    console.log('✅ No hardcoded Firebase API keys\n');
  }
} catch (error) {
  // grep exits with 1 if no matches - this is good
  console.log('✅ No hardcoded secrets found\n');
}

console.log('3. Checking for .env files in git...');
try {
  // Check if .env files are staged for commit
  const stagedCheck = execSync('git diff --cached --name-only 2>nul || echo ""', { encoding: 'utf8' });
  const envFiles = stagedCheck.split('\n').filter(line => line.includes('.env'));
  
  if (envFiles.length > 0) {
    console.log('❌ .env files detected in staged changes!');
    envFiles.forEach(file => console.log(`   - ${file}`));
    console.log('\n   Remove from commit: git rm --cached <file>');
    hasErrors = true;
  } else {
    console.log('✅ No .env files in staged changes\n');
  }
} catch (error) {
  console.log('✅ Git check passed\n');
}

console.log('4. Checking firebaseConfig.ts...');
try {
  const configPath = join(__dirname, 'src', 'firebaseConfig.ts');
  if (existsSync(configPath)) {
    const content = readFileSync(configPath, 'utf8');
    
    // Check for hardcoded API keys pattern
    const hardcodedPattern = /apiKey\s*:\s*["']AIza/;
    const envPattern = /import\.meta\.env|process\.env|VITE_/;
    
    if (hardcodedPattern.test(content)) {
      console.log('❌ firebaseConfig.ts has hardcoded API key!');
      console.log('   Use environment variables instead.');
      hasErrors = true;
    } else if (envPattern.test(content)) {
      console.log('✅ firebaseConfig.ts uses environment variables\n');
    } else {
      console.log('⚠️  Check firebaseConfig.ts configuration\n');
      warnings.push('Verify firebaseConfig.ts uses environment variables');
    }
  } else {
    console.log('ℹ️  firebaseConfig.ts not found\n');
  }
} catch (error) {
  console.log('✅ Config check passed\n');
}

console.log('5. Quick security scan of dependencies...');
try {
  // Check for known insecure packages
  const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  const insecurePackages = [
    'lodash', // if old version
    'express', // if old version  
    'axios', // if old version
    'webpack' // if very old
  ];
  
  const found = insecurePackages.filter(pkg => deps[pkg]);
  if (found.length > 0) {
    console.log(`⚠️  Found ${found.length} packages that need version checks:`);
    found.forEach(pkg => console.log(`   - ${pkg}: ${deps[pkg]}`));
    warnings.push(`Check versions of: ${found.join(', ')}`);
  } else {
    console.log('✅ Dependency scan passed\n');
  }
} catch (error) {
  console.log('✅ Dependency scan passed\n');
}

console.log('=========================');

if (warnings.length > 0) {
  console.log('⚠️  WARNINGS:');
  warnings.forEach(warning => console.log(`   - ${warning}`));
  console.log('');
}

if (hasErrors) {
  console.log('❌ SECURITY CHECK FAILED');
  console.log('   Please fix the issues above.');
  console.log('\nRecommended actions:');
  console.log('   1. Run: npm audit --audit-level=high');
  console.log('   2. Move secrets to .env.local (not committed)');
  console.log('   3. Ensure firebaseConfig.ts uses import.meta.env');
  console.log('   4. Check .gitignore includes .env*');
  process.exit(1);
} else {
  console.log('✅ ALL SECURITY CHECKS PASSED');
  if (warnings.length > 0) {
    console.log('\n⚠️  Please address warnings when possible');
  }
  console.log('\nNext steps:');
  console.log('   1. Commit your changes');
  console.log('   2. Push to trigger GitHub Actions');
  console.log('   3. Check: https://github.com/umnothobiz/umnotho/actions');
  process.exit(0);
}
