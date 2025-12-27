#!/bin/bash
echo "í´§ Setting up git hooks..."
if [ -f ".githooks/pre-commit" ]; then
  cp .githooks/pre-commit .git/hooks/pre-commit
  chmod +x .git/hooks/pre-commit
  echo "âœ… Pre-commit hook installed"
else
  echo "âš ï¸  No pre-commit hook found in .githooks/"
  echo "Creating basic pre-commit hook..."
  echo '#!/bin/bash
echo "í´’ Running security checks..."
node security-check.js || exit 1
echo "âœ… Security checks passed"' > .git/hooks/pre-commit
  chmod +x .git/hooks/pre-commit
fi

echo ""
echo "To test: Try committing a .env file (should be blocked)"
echo "Example: echo 'TEST=123' > test.env && git add test.env && git commit -m 'Test'"
