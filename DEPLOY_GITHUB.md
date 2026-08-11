# Deploy to GitHub / GitHub Pages

## Option A — Upload through GitHub UI

1. Create a new repository.
2. Prefer **Private** until the app has been sanitized.
3. Upload all files from this ZIP into the repository root. Do not upload the ZIP itself.
4. Make sure `index.html` is in the repository root.
5. Commit the files.
6. Open **Settings → Pages**.
7. Select **Deploy from a branch**.
8. Select branch `main` and folder `/ (root)`.
9. Save.
10. Open the generated GitHub Pages URL once the deployment finishes.

## Option B — Upload through Git CLI

```bash
git init
git add .
git commit -m "Initial index-1 static app"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO>.git
git push -u origin main
```

Then enable Pages from **Settings → Pages**.

## Important

GitHub Pages is static hosting. If this app needs Python, Node server processing, database, login, or scheduled jobs, move those parts into a separate backend/API.
