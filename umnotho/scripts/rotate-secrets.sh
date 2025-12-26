#!/bin/bash
# Emergency secret rotation script for Unmotho
set -e

echo "🚨 EMERGENCY SECRET ROTATION FOR UNMOTHO 🚨"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}Firebase CLI not found. Install with: npm install -g firebase-tools${NC}"
    exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}jq not found. Install with: brew install jq (macOS) or apt-get install jq (Linux)${NC}"
    exit 1
fi

rotate_firebase_web_api_key() {
    echo -e "\n${YELLOW}Step 1: Rotating Firebase Web API Key${NC}"
    
    # Get current project
    PROJECT_ID=$(firebase projects:list | grep '(current)' | awk '{print $2}')
    
    if [ -z "$PROJECT_ID" ]; then
        echo -e "${RED}No Firebase project found. Make sure you're logged in.${NC}"
        firebase login
        PROJECT_ID=$(firebase projects:list | grep '(current)' | awk '{print $2}')
    fi
    
    echo "Current project: $PROJECT_ID"
    
    # Instructions for manual rotation
    echo -e "\n${YELLOW}Manual steps required:${NC}"
    echo "1. Go to: https://console.firebase.google.com/project/$PROJECT_ID/settings/general"
    echo "2. Under 'Your apps', select your web app"
    echo "3. Click 'Add fingerprint' or 'Regenerate secret'"
    echo "4. Update the new API key in:"
    echo "   - src/firebaseConfig.ts"
    echo "   - All environment variables"
    echo "   - GitHub Secrets"
    read -p "Press Enter after completing these steps..."
}

rotate_service_account() {
    echo -e "\n${YELLOW}Step 2: Rotating Service Account${NC}"
    
    # Create new service account
    echo "Creating new service account..."
    SA_NAME="umnotho-service-account-$(date +%Y%m%d-%H%M%S)"
    
    # This requires Google Cloud CLI
    if command -v gcloud &> /dev/null; then
        PROJECT_ID=$(firebase projects:list | grep '(current)' | awk '{print $2}')
        
        gcloud iam service-accounts create $SA_NAME \
            --display-name="Unmotho Service Account" \
            --project=$PROJECT_ID
            
        # Add Firebase Admin role
        gcloud projects add-iam-policy-binding $PROJECT_ID \
            --member="serviceAccount:$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
            --role="roles/firebase.admin" \
            --condition=None
            
        # Create and download key
        gcloud iam service-accounts keys create "./$SA_NAME-key.json" \
            --iam-account="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
            --project=$PROJECT_ID
            
        echo -e "${GREEN}New service account created: $SA_NAME-key.json${NC}"
        echo -e "${YELLOW}Update these locations:${NC}"
        echo "1. Firebase Functions environment"
        echo "2. GitHub Secrets"
        echo "3. Any deployment scripts"
    else
        echo -e "${RED}Google Cloud CLI not installed.${NC}"
        echo "Install with: https://cloud.google.com/sdk/docs/install"
    fi
}

rotate_github_secrets() {
    echo -e "\n${YELLOW}Step 3: Updating GitHub Secrets${NC}"
    
    echo "GitHub Secrets that need updating:"
    echo "1. FIREBASE_API_KEY"
    echo "2. FIREBASE_SERVICE_ACCOUNT"
    echo "3. FIREBASE_PROJECT_ID"
    echo "4. Any other Firebase-related secrets"
    
    echo -e "\n${YELLOW}Update these at:${NC}"
    echo "https://github.com/umnothobiz/umnotho/settings/secrets/actions"
    read -p "Press Enter after updating GitHub secrets..."
}

clean_git_history() {
    echo -e "\n${YELLOW}Step 4: Cleaning Git History${NC}"
    
    read -p "Do you want to remove secrets from git history? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Installing BFG Repo-Cleaner..."
        wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar -O bfg.jar
        
        echo "Creating backup..."
        git clone --mirror file://$(pwd) backup.git
        
        echo "Removing secrets patterns..."
        java -jar bfg.jar \
            --delete-files '*.{key,json,pem,p12,pfx}' \
            --replace-text .gitleaks.toml \
            --no-blob-protection \
            .
        
        echo "Cleaning up..."
        git reflog expire --expire=now --all
        git gc --prune=now --aggressive
        
        echo -e "${GREEN}Git history cleaned. Force push with: git push --force${NC}"
        echo -e "${RED}WARNING: This will rewrite history. Make sure all collaborators are aware.${NC}"
    fi
}

summary() {
    echo -e "\n${GREEN}✅ Rotation Summary${NC}"
    echo "================="
    echo "1. Firebase Web API Key - Manual update required"
    echo "2. Service Account - Check if created"
    echo "3. GitHub Secrets - Manual update required"
    echo "4. Git History - Optional cleanup done"
    echo ""
    echo "${YELLOW}Next steps:${NC}"
    echo "1. Update all environment files (.env.*)"
    echo "2. Update Firebase config in src/firebaseConfig.ts"
    echo "3. Update CI/CD pipeline variables"
    echo "4. Test all authentication flows"
    echo "5. Monitor logs for failed authentications"
}

# Run all steps
main() {
    echo "Starting emergency rotation at $(date)"
    echo ""
    
    rotate_firebase_web_api_key
    rotate_service_account
    rotate_github_secrets
    clean_git_history
    summary
    
    echo -e "\n${GREEN}Rotation process completed at $(date)${NC}"
}

# Execute
main "$@"