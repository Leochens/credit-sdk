# Credit SDK Documentation

This directory contains the documentation for Credit SDK, powered by [Docsify](https://docsify.js.org/).

## 📁 Structure

```
docs/
├── index.html              # Docsify configuration
├── HOME.md                 # Homepage
├── _coverpage.md          # Cover page
├── _sidebar.md            # Sidebar navigation
├── _navbar.md             # Top navigation bar
├── .nojekyll              # Tells GitHub Pages not to use Jekyll
├── _media/                # Images and assets
│   ├── icon.svg
│   └── logo.svg
├── API_REFERENCE.md       # API documentation
├── CONFIGURATION.md       # Configuration guide
├── INTEGRATION_EXAMPLES.md # Integration examples
├── TESTING.md             # Testing guide
├── DATABASE_SETUP.md      # Database setup
├── EXISTING_DATABASE_INTEGRATION.md # Existing DB integration
├── ADAPTER_IMPLEMENTATION_GUIDE.md  # Custom adapters
├── CONTRIBUTING.md        # Contributing guide
└── DEPLOYMENT.md          # Deployment guide
```

## 🚀 Quick Start

### View Locally

#### Option 1: Python HTTP Server

```bash
cd docs
python -m http.server 3000
```

Visit `http://localhost:3000`

#### Option 2: Docsify CLI

```bash
npm install -g docsify-cli
docsify serve docs
```

Visit `http://localhost:3000`

#### Option 3: VS Code Live Server

1. Install "Live Server" extension
2. Right-click `index.html`
3. Select "Open with Live Server"

### Deploy to GitHub Pages

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

Quick steps:
1. Push to GitHub
2. Go to Settings > Pages
3. Select `main` branch and `/docs` folder
4. Save and wait 1-2 minutes

Your docs will be live at: `https://Leochens.github.io/credit-sdk/`

## ✏️ Editing Documentation

### Adding a New Page

1. Create a new `.md` file in the `docs/` folder:
   ```bash
   touch docs/NEW_PAGE.md
   ```

2. Add content using Markdown

3. Add link to `_sidebar.md`:
   ```markdown
   * [New Page](/NEW_PAGE.md)
   ```

### Updating Existing Pages

Simply edit the `.md` files. Changes will be reflected immediately when you refresh the page.

### Adding Images

1. Place images in `docs/_media/` folder
2. Reference in markdown:
   ```markdown
   ![Alt text](_media/image.png)
   ```

### Code Blocks

Use fenced code blocks with language specification:

````markdown
```typescript
const engine = new CreditsEngine({ storage: adapter, config });
```
````

### Alerts

Use flexible alerts plugin:

```markdown
> [!NOTE]
> This is a note

> [!TIP]
> This is a tip

> [!WARNING]
> This is a warning

> [!DANGER]
> This is a danger alert
```

### Tabs

Use tabs plugin for multiple code examples:

````markdown
<!-- tabs:start -->

#### **TypeScript**

```typescript
const result = await engine.charge({ userId, action });
```

#### **JavaScript**

```javascript
const result = await engine.charge({ userId, action });
```

<!-- tabs:end -->
````

## 🎨 Customization

### Changing Theme

Edit `docs/index.html` and change the CSS link:

```html
<!-- Available themes: vue, buble, dark, pure -->
<link rel="stylesheet" href="//cdn.jsdelivr.net/npm/docsify@4/lib/themes/vue.css">
```

### Customizing Colors

Edit the CSS variables in `docs/index.html`:

```css
:root {
  --theme-color: #42b983;
  --theme-color-dark: #2c8c5f;
}
```

### Adding Plugins

Add plugin scripts before `</body>` in `index.html`:

```html
<!-- Example: Add copy code plugin -->
<script src="//cdn.jsdelivr.net/npm/docsify-copy-code@2"></script>
```

Available plugins:
- Search
- Copy Code
- Pagination
- Zoom Image
- Tabs
- Flexible Alerts
- And more...

## 📝 Markdown Tips

### Internal Links

```markdown
[Link to API Reference](/API_REFERENCE.md)
[Link to specific section](/API_REFERENCE.md#charge)
```

### External Links

```markdown
[GitHub](https://github.com/Leochens/credit-sdk)
```

### Tables

```markdown
| Feature | Supported |
|---------|-----------|
| Prisma  | ✅        |
| MongoDB | ✅        |
```

### Task Lists

```markdown
- [x] Completed task
- [ ] Pending task
```

### Emoji

Use emoji directly or with shortcodes:

```markdown
:rocket: :sparkles: :tada:
```

## 🔍 Search

Search is automatically enabled. It indexes:
- All markdown files
- Headings (h1-h3)
- Content

To exclude a page from search, add to `index.html`:

```javascript
search: {
  paths: 'auto',
  exclude: ['/EXCLUDED_PAGE.md']
}
```

## 🌐 Multi-language Support

To add Chinese version:

1. Create `docs/zh-cn/` folder
2. Copy all `.md` files to `zh-cn/`
3. Translate content
4. Update `_navbar.md`:
   ```markdown
   * Language
     * [:uk: English](/)
     * [:cn: 中文](/zh-cn/)
   ```

## 📊 Analytics

To add Google Analytics, edit `index.html`:

```javascript
window.$docsify = {
  // ... other config
  ga: 'UA-XXXXXXXXX-X'
}
```

## 🐛 Troubleshooting

### Styles Not Loading

- Check CDN links in `index.html`
- Try different CDN (jsdelivr, unpkg, cdnjs)
- Clear browser cache

### Links Not Working

- Ensure file names match exactly (case-sensitive)
- Use `/` prefix for absolute paths
- Check `_sidebar.md` for correct paths

### Search Not Working

- Wait for page to fully load
- Check browser console for errors
- Verify search plugin is loaded

### Images Not Showing

- Check file path is correct
- Ensure images are in `_media/` folder
- Use relative paths: `_media/image.png`

## 📚 Resources

- [Docsify Documentation](https://docsify.js.org/)
- [Docsify Plugins](https://docsify.js.org/#/plugins)
- [Markdown Guide](https://www.markdownguide.org/)
- [GitHub Pages](https://pages.github.com/)

## 🤝 Contributing to Docs

1. Fork the repository
2. Create a branch: `git checkout -b docs/improve-api-docs`
3. Make changes to markdown files
4. Test locally
5. Commit: `git commit -m "docs: improve API documentation"`
6. Push and create Pull Request

## 📄 License

Documentation is licensed under MIT License.

---

For deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md)
