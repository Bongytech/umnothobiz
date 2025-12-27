#!/usr/bin/env node

/**
 * Security Monitoring Script
 * Runs security checks and generates reports
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple console colors for ES modules
const colors = {
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`
};

console.log(colors.blue(colors.bold('\n🔒 UMNOTHO Security Audit Report\n')));
console.log(colors.blue('='.repeat(60)));

// Configuration
const REPORTS_DIR = './security-reports';
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const REPORT_FILE = `${REPORTS_DIR}/security-report-${TIMESTAMP}.json`;

// Ensure reports directory exists
if (!existsSync(REPORTS_DIR)) {
  mkdirSync(REPORTS_DIR, { recursive: true });
}

const securityChecks = [];

/**
 * Run a command and capture output
 */
function runCommand(command, description) {
  console.log(colors.blue(`\n▶ ${description}`));
  console.log(colors.blue(`  Command: ${command}`));
  
  try {
    const output = execSync(command, { 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    console.log(colors.green(`  ✓ Completed successfully`));
    return { success: true, output };
  } catch (error) {
    console.log(colors.yellow(`  ⚠ Completed with warnings/errors`));
    return { 
      success: false, 
      error: error.message,
      output: error.stdout || error.stderr || ''
    };
  }
}

/**
 * Run npm audit
 */
function runNpmAudit() {
  const result = runCommand(
    'npm audit --json', 
    'Running npm audit for vulnerable dependencies'
  );
  
  const check = {
    name: 'npm_audit',
    description: 'NPM Dependency Security Audit',
    timestamp: new Date().toISOString()
  };
  
  if (result.success) {
    try {
      const auditData = JSON.parse(result.output);
      check.result = 'success';
      check.data = auditData;
      check.summary = {
        vulnerabilities: auditData.metadata?.vulnerabilities || {},
        totalDependencies: Object.keys(auditData.advisories || {}).length
      };
    } catch (e) {
      check.result = 'error';
      check.error = 'Failed to parse npm audit output';
    }
  } else {
    check.result = 'error';
    check.error = result.error;
  }
  
  securityChecks.push(check);
  return check;
}

/**
 * Run ESLint security rules
 */
function runEslintSecurity() {
  const result = runCommand(
    'npm run lint:security', 
    'Running ESLint security rules check'
  );
  
  const check = {
    name: 'eslint_security',
    description: 'ESLint Security Rules Check',
    timestamp: new Date().toISOString()
  };
  
  check.result = result.success ? 'success' : 'warning';
  check.output = result.output.substring(0, 1000); // Limit output size
  
  // Extract warnings/errors count
  const lines = result.output.split('\n');
  const errorMatch = lines.find(line => line.includes('error') && line.includes('✖'));
  const warningMatch = lines.find(line => line.includes('warning') && line.includes('⚠'));
  
  if (errorMatch) {
    const errors = errorMatch.match(/(\d+) error/);
    check.errors = errors ? parseInt(errors[1]) : 0;
  }
  
  if (warningMatch) {
    const warnings = warningMatch.match(/(\d+) warning/);
    check.warnings = warnings ? parseInt(warnings[1]) : 0;
  }
  
  securityChecks.push(check);
  return check;
}

/**
 * Check for outdated dependencies
 */
function checkOutdatedDependencies() {
  const result = runCommand(
    'npm outdated --json || echo "{}"', 
    'Checking for outdated dependencies'
  );
  
  const check = {
    name: 'outdated_deps',
    description: 'Outdated Dependencies Check',
    timestamp: new Date().toISOString()
  };
  
  if (result.output && result.output.trim() && result.output.trim() !== '{}') {
    try {
      const outdatedData = JSON.parse(result.output);
      check.result = 'warning';
      check.data = outdatedData;
      check.summary = {
        totalOutdated: Object.keys(outdatedData).length,
        packages: Object.keys(outdatedData)
      };
    } catch (e) {
      check.result = 'success';
      check.summary = { totalOutdated: 0 };
    }
  } else {
    check.result = 'success';
    check.summary = { totalOutdated: 0 };
  }
  
  securityChecks.push(check);
  return check;
}

/**
 * Check for known malicious packages
 */
function checkForMaliciousPackages() {
  console.log(colors.blue('\n▶ Checking for known malicious packages'));
  
  const check = {
    name: 'malicious_packages',
    description: 'Malicious Packages Check',
    timestamp: new Date().toISOString(),
    result: 'info'
  };
  
  // Common malicious patterns to check
  const suspiciousPatterns = [
    'eslint-config-google',
    'eslint-config-airbnb',
    'crossenv', // Malicious copy of cross-env
    'nodemon', // Sometimes spoofed
    'discord.js-selfbot-v13', // Known malicious
    'selfbot.discord', // Known malicious
    'minecraft-server-hosting', // Known malicious
    'free-nitro', // Known malicious
  ];
  
  try {
    const packageJsonPath = join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };
    
    const suspicious = [];
    Object.keys(allDeps).forEach(dep => {
      suspiciousPatterns.forEach(pattern => {
        if (dep.toLowerCase().includes(pattern.toLowerCase())) {
          suspicious.push(dep);
        }
      });
    });
    
    if (suspicious.length > 0) {
      check.result = 'warning';
      check.suspiciousPackages = suspicious;
      console.log(colors.yellow(`  ⚠ Found ${suspicious.length} potentially suspicious packages`));
      console.log(colors.yellow(`  Packages: ${suspicious.join(', ')}`));
    } else {
      check.result = 'success';
      console.log(colors.green(`  ✓ No known malicious packages detected`));
    }
    
  } catch (error) {
    check.result = 'error';
    check.error = error.message;
    console.log(colors.red(`  ✗ Error checking packages: ${error.message}`));
  }
  
  securityChecks.push(check);
  return check;
}

/**
 * Generate summary report
 */
function generateSummary() {
  console.log(colors.blue(colors.bold('\n📊 Security Audit Summary\n')));
  console.log(colors.blue('='.repeat(60)));
  
  let totalChecks = securityChecks.length;
  let passedChecks = securityChecks.filter(c => c.result === 'success').length;
  let warningChecks = securityChecks.filter(c => c.result === 'warning').length;
  let errorChecks = securityChecks.filter(c => c.result === 'error').length;
  
  console.log(`Total Checks: ${totalChecks}`);
  console.log(colors.green(`Passed: ${passedChecks}`));
  console.log(colors.yellow(`Warnings: ${warningChecks}`));
  console.log(colors.red(`Errors: ${errorChecks}`));
  
  // Show details for warnings and errors
  securityChecks.forEach(check => {
    if (check.result !== 'success') {
      console.log(colors.blue(`\n${check.description}:`));
      console.log(`  Status: ${check.result === 'warning' ? colors.yellow('WARNING') : colors.red('ERROR')}`);
      
      if (check.summary) {
        Object.entries(check.summary).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            console.log(`  ${key}: ${value.length > 0 ? value.join(', ') : 'None'}`);
          } else {
            console.log(`  ${key}: ${value}`);
          }
        });
      }
    }
  });
  
  // Save report to file
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalChecks,
      passedChecks,
      warningChecks,
      errorChecks
    },
    checks: securityChecks
  };
  
  writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  console.log(colors.blue(`\n📄 Full report saved to: ${REPORT_FILE}`));
  
  // Generate HTML report
  generateHtmlReport(report);
  
  // Exit with appropriate code
  if (errorChecks > 0) {
    console.log(colors.red(colors.bold('\n❌ Security audit failed with errors')));
    process.exit(1);
  } else if (warningChecks > 0) {
    console.log(colors.yellow(colors.bold('\n⚠ Security audit completed with warnings')));
    process.exit(0);
  } else {
    console.log(colors.green(colors.bold('\n✅ Security audit passed successfully')));
    process.exit(0);
  }
}

/**
 * Generate HTML report
 */
function generateHtmlReport(report) {
  const htmlReport = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Audit Report - ${new Date().toLocaleString()}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
        }
        .summary-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }
        .card.success { border-left: 5px solid #28a745; }
        .card.warning { border-left: 5px solid #ffc107; }
        .card.error { border-left: 5px solid #dc3545; }
        .card.info { border-left: 5px solid #17a2b8; }
        
        .check-list {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }
        .check-item {
            padding: 15px;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .check-item:last-child {
            border-bottom: none;
        }
        .status {
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.9em;
            font-weight: bold;
        }
        .status.success { background: #d4edda; color: #155724; }
        .status.warning { background: #fff3cd; color: #856404; }
        .status.error { background: #f8d7da; color: #721c24; }
        .status.info { background: #d1ecf1; color: #0c5460; }
        
        .timestamp {
            color: #666;
            font-size: 0.9em;
            margin-top: 20px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔒 Security Audit Report</h1>
        <p>Generated on ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="summary-cards">
        <div class="card success">
            <h3>✅ Passed</h3>
            <h2>${report.summary.passedChecks}</h2>
        </div>
        <div class="card warning">
            <h3>⚠ Warnings</h3>
            <h2>${report.summary.warningChecks}</h2>
        </div>
        <div class="card error">
            <h3>❌ Errors</h3>
            <h2>${report.summary.errorChecks}</h2>
        </div>
        <div class="card info">
            <h3>📊 Total Checks</h3>
            <h2>${report.summary.totalChecks}</h2>
        </div>
    </div>
    
    <div class="check-list">
        <h2>Security Checks</h2>
        ${report.checks.map(check => `
        <div class="check-item">
            <div>
                <strong>${check.description}</strong>
                <div style="font-size: 0.9em; color: #666;">
                    ${new Date(check.timestamp).toLocaleTimeString()}
                </div>
            </div>
            <div class="status ${check.result}">
                ${check.result.toUpperCase()}
            </div>
        </div>
        `).join('')}
    </div>
    
    <div class="timestamp">
        Report generated at ${new Date(report.timestamp).toLocaleString()}
    </div>
</body>
</html>
  `;
  
  const htmlFile = `${REPORTS_DIR}/security-report-${TIMESTAMP}.html`;
  writeFileSync(htmlFile, htmlReport);
  console.log(colors.blue(`📄 HTML report saved to: ${htmlFile}`));
}

/**
 * Main function
 */
async function main() {
  try {
    console.log(colors.blue(`Starting security audit at ${new Date().toLocaleString()}\n`));
    
    // Run security checks
    runNpmAudit();
    runEslintSecurity();
    checkOutdatedDependencies();
    checkForMaliciousPackages();
    
    // Generate summary
    generateSummary();
    
  } catch (error) {
    console.error(colors.red(`\n❌ Unexpected error: ${error.message}`));
    process.exit(1);
  }
}

// Run the script
main();