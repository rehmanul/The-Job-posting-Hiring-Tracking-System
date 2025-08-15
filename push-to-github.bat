@echo off
echo Setting up GitHub authentication and pushing to repository...

echo.
echo Option 1: Using GitHub CLI (Recommended)
echo gh auth login
echo git push -u origin main

echo.
echo Option 2: Using Personal Access Token
echo 1. Go to GitHub Settings ^> Developer settings ^> Personal access tokens
echo 2. Generate new token with 'repo' permissions
echo 3. Run: git remote set-url origin https://YOUR_TOKEN@github.com/Shojol-R7/JobTracker-Expert.git
echo 4. Run: git push -u origin main

echo.
echo Option 3: Using SSH (if configured)
echo git remote set-url origin git@github.com:Shojol-R7/JobTracker-Expert.git
echo git push -u origin main

echo.
pause