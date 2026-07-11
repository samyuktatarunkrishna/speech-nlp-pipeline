#!/bin/bash

# GitHub Setup and Push Script
set -e

# Base directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=============================================="
echo " Setting up Git and uploading to GitHub"
echo "=============================================="

# Initialize Git if not already done
if [ ! -d ".git" ]; then
    echo "Initializing local Git repository..."
    git init
    git branch -M main
else
    echo "Git repository already initialized."
fi

# Add files and commit
echo "Staging files..."
git add .

echo "Creating initial commit..."
# Avoid failing if nothing to commit
git diff-index --quiet HEAD -- || git commit -m "Initial commit - SpeechInsight NLP Analysis Pipeline"

# Check GitHub CLI authentication status
echo "Checking GitHub CLI status..."
if gh auth status >/dev/null 2>&1; then
    echo "✓ GitHub CLI is authenticated!"
    
    # Try to create GitHub repository
    REPO_NAME="speech-nlp-pipeline"
    echo "Creating remote GitHub repository '$REPO_NAME'..."
    
    if gh repo view "$REPO_NAME" >/dev/null 2>&1; then
        echo "Repository '$REPO_NAME' already exists on GitHub."
        # Ensure remote is set
        if git remote get-url origin >/dev/null 2>&1; then
            echo "Remote 'origin' is already set."
        else
            USERNAME=$(gh api user -q .login)
            echo "Setting remote origin to git@github.com:$USERNAME/$REPO_NAME.git"
            git remote add origin "https://github.com/$USERNAME/$REPO_NAME.git"
        fi
    else
        # Create repo and push
        gh repo create "$REPO_NAME" --public --source=. --remote=origin --push
        echo "✓ Repository successfully created and pushed to GitHub!"
        exit 0
    fi
    
    # Push if not already pushed
    echo "Pushing commits to remote..."
    git push -u origin main
    echo "✓ Code successfully pushed to GitHub!"
else
    echo "❌ Error: GitHub CLI (gh) is not authenticated."
    echo "Please run: gh auth login"
    echo "Then rerun this script."
    exit 1
fi
