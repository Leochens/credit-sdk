# Deploying Documentation to GitHub Pages

This guide explains how to deploy the Credit SDK documentation to GitHub Pages.

## Prerequisites

- A GitHub account
- A GitHub repository for Credit SDK
- Git installed locally

## Step 1: Push Documentation to GitHub

Make sure all documentation files are committed and pushed to your repository:

```bash
git add docs/
git commit -m "docs: add Docsify documentation"
git push origin main
```

## Step 2: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click on **Settings** (top right)
3. Scroll down to **Pages** in the left sidebar
4. Under **Build and deployment**:
   - **Source**: Select "Deploy from a branch"
   - **Branch**: Select `main` (or `master`)
   - **Folder**: Select `/docs`
5. Click **Save**

## Step 3: Wait for Deployment

GitHub will automatically build and deploy your site. This usually takes 1-2 minutes.

You'll see a message like:
```
Your site is live at https://Leochens.github.io/credit-sdk/
```

## Step 4: Access Your Documentation

Your documentation will be available at:
```
https://Leochens.github.io/credit-sdk/
```

Replace `Leochens` with your GitHub username and `credit-sdk` with your repository name.

## Custom Domain (Optional)

If you want to use a custom domain:

1. Add a `CNAME` file to the `docs/` folder:
   ```bash
   echo "docs.yourdomain.com" > docs/CNAME
   ```

2. Configure DNS:
   - Add a CNAME record pointing to `Leochens.github.io`
   - Or add A records pointing to GitHub's IPs:
     ```
     185.199.108.153
     185.199.109.153
     185.199.110.153
     185.199.111.153
     ```

3. In GitHub Settings > Pages, enter your custom domain

## Troubleshooting

### 404 Error

If you get a 404 error:
- Make sure the `.nojekyll` file exists in the `docs/` folder
- Check that GitHub Pages is enabled and pointing to `/docs`
- Wait a few minutes for deployment to complete

### Styles Not Loading

If styles don't load:
- Check browser console for errors
- Verify all CDN links in `index.html` are accessible
- Try clearing browser cache

### Links Not Working

If internal links don't work:
- Make sure all markdown files are in the `docs/` folder
- Check that file names match exactly (case-sensitive)
- Verify links in `_sidebar.md` are correct

## Local Testing

Before deploying, you can test locally:

### Option 1: Using Python

```bash
cd docs
python -m http.server 3000
```

Then visit `http://localhost:3000`

### Option 2: Using Node.js

```bash
npm install -g docsify-cli
docsify serve docs
```

Then visit `http://localhost:3000`

### Option 3: Using VS Code

Install the "Live Server" extension and right-click `index.html` > "Open with Live Server"

## Updating Documentation

To update your documentation:

1. Edit markdown files in the `docs/` folder
2. Commit and push changes:
   ```bash
   git add docs/
   git commit -m "docs: update documentation"
   git push origin main
   ```
3. GitHub Pages will automatically rebuild (1-2 minutes)

## Advanced Configuration

### Adding Google Analytics

Edit `docs/index.html` and add your tracking ID:

```javascript
window.$docsify = {
  // ... other config
  ga: 'UA-XXXXXXXXX-X'  // Your Google Analytics ID
}
```

### Enabling Search

Search is already enabled in the configuration. To customize:

```javascript
search: {
  maxAge: 86400000,
  paths: 'auto',
  placeholder: 'Type to search',
  noData: 'No Results!',
  depth: 3
}
```

### Custom Theme

To change the theme, edit the CSS link in `index.html`:

```html
<!-- Available themes: vue, buble, dark, pure -->
<link rel="stylesheet" href="//cdn.jsdelivr.net/npm/docsify@4/lib/themes/dark.css">
```

### Adding Plugins

Add plugin scripts before the closing `</body>` tag:

```html
<!-- Example: Add tabs plugin -->
<script src="https://cdn.jsdelivr.net/npm/docsify-tabs@1"></script>
```

## Best Practices

1. **Keep URLs Clean**: Use lowercase and hyphens in file names
2. **Test Locally**: Always test before pushing
3. **Use Relative Links**: For better portability
4. **Optimize Images**: Compress images before adding
5. **Version Control**: Commit documentation with code changes
6. **Update Regularly**: Keep documentation in sync with code

## Resources

- [Docsify Documentation](https://docsify.js.org/)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [Markdown Guide](https://www.markdownguide.org/)

## Need Help?

- [GitHub Pages Issues](https://github.com/github/pages-gem/issues)
- [Docsify Issues](https://github.com/docsifyjs/docsify/issues)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/github-pages)
