# CLAUDE.md

## Language

- **Everything on GitHub is in English**: pull request titles and descriptions, commit messages, branch names, review replies, and PR or issue comments.
- **Talk to the user in Simplified Chinese.**
- **Inside the code, match what is already there**: the app's UI text is Chinese, and code comments are Chinese.
- **Keep both READMEs in sync**: `README.md` (English) and `README.zh-CN.md` (Chinese) cover the same content; update both.
- Older commits on `main` have Chinese messages. Leave them as they are; never rewrite `main`'s history.

## Before pushing

Run these (see README.md → Development for the rest):

```
npx eslint src      # 0 errors expected; 2 warnings are pre-existing
npm test
npm run test:e2e
```

Merging to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml` once the tests pass.
