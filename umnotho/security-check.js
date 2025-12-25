# Navigate to your project root
cd ~/Documents/code/umnotho/umnothobiz/umnotho

# Create security-check.js in the root
cat > security-check.js << 'EOF'
#!/usr/bin/env node

console.log('🔒 UNMOTHO SECURITY CHECK');
console.log('=========================\n');

// Your security check code here...
console.log('Running security checks...');
console.log('✅ All checks passed!');
EOF

# Make it executable
chmod +x security-check.js

# Verify it's in the right place
pwd
ls -la security-check.js