# 📚 Documentation Setup Guide

This guide explains how to set up and deploy the Credit SDK documentation using Docsify and GitHub Pages.

## ✅ What's Been Set Up

Your documentation is now powered by **Docsify** - a magical documentation site generator that:
- ✨ Renders Markdown files on-the-fly (no build step!)
- 🎨 Beautiful Vue.js-inspired theme
- 🔍 Full-text search
- 📱 Mobile responsive
- 🌐 Multi-language support ready
- 🚀 Fast and lightweight

## 📁 Documentation Structure

```
docs/
├── index.html                          # Docsify configuration
├── HOME.md                             # Homepage
├── _coverpage.md                       # Cover page with logo
├── _sidebar.md                         # Left sidebar navigation
├── _navbar.md                          # Top navigation bar
├── .nojekyll                           # GitHub Pages config
├── _media/                             # Images and assets
│   ├── icon.svg                        # Large icon for cover
│   └── logo.svg                        # Small logo for navbar
├── API_REFERENCE.md                    # Complete API docs
├── CONFIGURATION.md                    # Configuration guide
├── INTEGRATION_EXAMPLES.md             # Integration examples
├── TESTING.md                          # Testing guide
├── DATABASE_SETUP.md                   # Database setup
├── EXISTING_DATABASE_INTEGRATION.md    # Existing DB integration
├── ADAPTER_IMPLEMENTATION_GUIDE.md     # Custom adapters
├── DEPLOYMENT.md                       # Deployment instructions
└── README_DOCS.md                      # Documentation guide
```

## 🚀 Quick Start

### Step 1: Test Locally

Before deploying, test your documentation locally:

**Option A: Python (Easiest)**
```bash
cd docs
python -m http.server 3000
```

**Option B: Docsify CLI (Recommended)**
```bash
npm install -g docsify-cli
docsify serve docs
```

**Option C: VS Code Live Server**
1. Install "Live Server" extension
2. Right-click `docs/index.html`
3. Select "Open with Live Server"

Then visit: `http://localhost:3000`

### Step 2: Deploy to GitHub Pages

1. **Push to GitHub**
   ```bash
   git add docs/
   git commit -m "docs: add Docsify documentation site"
   git push origin main
   ```

2. **Enable GitHub Pages**
   - Go to your repository on GitHub
   - Click **Settings** → **Pages**
   - Under "Build and deployment":
     - Source: **Deploy from a branch**
     - Branch: **main**
     - Folder: **/docs**
   - Click **Save**

3. **Wait for Deployment**
   - GitHub will build your site (1-2 minutes)
   - You'll see: "Your site is live at https://Leochens.github.io/credit-sdk/"

4. **Access Your Docs**
   ```
   https://Leochens.github.io/credit-sdk/
   ```

## 🎨 Customization

### Change Theme

Edit `docs/index.html`, line ~20:

```html
<!-- Available themes: vue, buble, dark, pure -->
<link rel="stylesheet" href="//cdn.jsdelivr.net/npm/docsify@4/lib/themes/vue.css">
```

### Change Colors

Edit `docs/index.html`, CSS section:

```css
:root {
  --theme-color: #42b983;  /* Change this */
  --theme-color-dark: #2c8c5f;  /* And this */
}
```

### Update Logo

Replace files in `docs/_media/`:
- `icon.svg` - Large icon for cover page
- `logo.svg` - Small logo for navbar

### Modify Navigation

Edit `docs/_sidebar.md` to change left sidebar navigation.

## ✏️ Adding Content

### Add a New Page

1. Create a new markdown file:
   ```bash
   echo "# My New Page" > docs/MY_NEW_PAGE.md
   ```

2. Add to sidebar (`docs/_sidebar.md`):
   ```markdown
   * [My New Page](/MY_NEW_PAGE.md)
   ```

3. Commit and push:
   ```bash
   git add docs/
   git commit -m "docs: add new page"
   git push
   ```

### Update Existing Page

Simply edit the `.md` file and push:

```bash
git add docs/API_REFERENCE.md
git commit -m "docs: update API reference"
git push
```

## 🌐 Multi-Language Support

To add Chinese version:

1. Create Chinese folder:
   ```bash
   mkdir -p docs/zh-cn
   ```

2. Copy and translate files:
   ```bash
   cp docs/HOME.md docs/zh-cn/HOME.md
   # Edit docs/zh-cn/HOME.md with Chinese content
   ```

3. Update navbar (`docs/_navbar.md`):
   ```markdown
   * Language
     * [:uk: English](/)
     * [:cn: 中文](/zh-cn/)
   ```

## 🔍 Features Enabled

Your documentation includes:

- ✅ **Full-text search** - Search across all pages
- ✅ **Code highlighting** - TypeScript, JavaScript, SQL, etc.
- ✅ **Copy code button** - One-click code copying
- ✅ **Pagination** - Previous/Next navigation
- ✅ **Zoom images** - Click to enlarge
- ✅ **Emoji support** - Use :emoji: syntax
- ✅ **Tabs** - Multiple code examples
- ✅ **Alerts** - Note, Tip, Warning, Danger boxes
- ✅ **Edit on GitHub** - Link to edit each page

## 📊 Analytics (Optional)

To add Google Analytics:

1. Get your tracking ID from Google Analytics
2. Edit `docs/index.html`:
   ```javascript
   window.$docsify = {
     // ... other config
     ga: 'UA-XXXXXXXXX-X'  // Your tracking ID
   }
   ```

## 🔧 Troubleshooting

### Documentation Not Loading

**Problem**: 404 error or blank page

**Solution**:
1. Check `.nojekyll` file exists in `docs/`
2. Verify GitHub Pages is enabled
3. Wait 2-3 minutes for deployment
4. Clear browser cache

### Styles Not Loading

**Problem**: Plain text, no styling

**Solution**:
1. Check internet connection (CDN links)
2. Try different browser
3. Check browser console for errors

### Links Not Working

**Problem**: Clicking links shows 404

**Solution**:
1. Ensure file names match exactly (case-sensitive)
2. Use `/` prefix: `/API_REFERENCE.md` not `API_REFERENCE.md`
3. Check `_sidebar.md` for correct paths

### Search Not Working

**Problem**: Search box doesn't find anything

**Solution**:
1. Wait for page to fully load
2. Check browser console for errors
3. Try refreshing the page

## 📝 Best Practices

1. **Keep URLs Clean**
   - Use lowercase: `api-reference.md` not `API_Reference.md`
   - Use hyphens: `database-setup.md` not `database_setup.md`

2. **Organize Content**
   - Group related pages in sidebar
   - Use clear, descriptive titles
   - Add table of contents for long pages

3. **Write Good Docs**
   - Start with examples
   - Explain the "why" not just the "how"
   - Include code snippets
   - Add troubleshooting sections

4. **Test Before Pushing**
   - Always test locally first
   - Check all links work
   - Verify code examples are correct

5. **Keep in Sync**
   - Update docs when code changes
   - Version documentation if needed
   - Add changelog entries

## 🎯 Next Steps

1. **Customize Your Docs**
   - Update `Leochens` in all files
   - Add your logo
   - Choose your theme colors

2. **Add More Content**
   - API examples
   - Tutorials
   - FAQ section
   - Video guides

3. **Promote Your Docs**
   - Add link to README
   - Share on social media
   - Add to package.json

4. **Monitor Usage**
   - Add Google Analytics
   - Track popular pages
   - Gather feedback

## 📚 Resources

- [Docsify Documentation](https://docsify.js.org/)
- [Docsify Plugins](https://docsify.js.org/#/plugins)
- [GitHub Pages Guide](https://pages.github.com/)
- [Markdown Guide](https://www.markdownguide.org/)

## 🤝 Need Help?

- Check [DEPLOYMENT.md](docs/DEPLOYMENT.md) for deployment issues
- Check [README_DOCS.md](docs/README_DOCS.md) for editing guide
- Open an issue on GitHub
- Ask in discussions

---

**Your documentation is ready! 🎉**

Test it locally, then push to GitHub and enable Pages. Your beautiful docs will be live in minutes!
