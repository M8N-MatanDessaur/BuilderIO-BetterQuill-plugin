# Builder.io Rich Text Editor Plugin

A comprehensive Quill.js-based rich text editor plugin for Builder.io with advanced features including tables, dark mode, fullscreen editing, and code view.

## Features

### 📝 Text Formatting
- **Headers**: H1-H6 heading styles
- **Font Families**: Multiple font options (Arial, Comic Sans, Courier New, Georgia, Helvetica, Lucida, Times New Roman, Verdana)
- **Font Sizes**: 12 preset sizes from 10px to 64px
- **Text Styles**: Bold, Italic, Underline, Strikethrough
- **Colors**: Full color picker for text and background highlighting
- **Alignment**: Left, Center, Right, Justify
- **Text Direction**: LTR/RTL support

### 📋 Content Elements
- **Lists**: Ordered, Bullet, and Checklist
- **Indentation**: Increase/Decrease
- **Blockquotes**: Quote formatting
- **Code Blocks**: Syntax highlighting with highlight.js (Atom One Dark theme)
- **Superscript/Subscript**: Scientific notation support
- **Formulas**: Mathematical equations with KaTeX support

### 🎨 Advanced Features
- **Tables**: Full table support with merge/split cells, add/remove rows and columns
- **Images**: Insert and manage images
- **Videos**: Embed video content
- **Links**: Hyperlink management
- **Dark Mode**: Toggle between light and dark themes
- **Fullscreen Mode**: Distraction-free editing experience
- **Code View**: Toggle between visual editor and HTML source code

## Installation

1. **Install Dependencies**

```bash
npm install
```

2. **Start Development Server**

```bash
npm start
```

The plugin will be available at `http://localhost:1268/plugin.system.js`

3. **Build for Production**

```bash
npm run build
```

The production build will be in the `dist` folder.

## Adding the Plugin to Builder.io

### Local Development

1. Start the development server: `npm start`
2. Go to [Builder.io Account Settings](https://builder.io/account/settings)
3. Click the pencil icon next to "Plugins"
4. Add the local URL: `http://localhost:1268/plugin.system.js`
5. Click Save

**Note for Chrome Users**: When developing locally on `http://localhost`, you need to allow insecure content:
- Click the shield icon in the address bar
- Select "Load unsafe scripts"
- The page will reload

### Using the Plugin

1. Go to **Models** in Builder.io
2. Select or create a model
3. Click **+ New Field**
4. In the **Type** dropdown, scroll down and select **RichText**
5. The rich text editor will appear with all features

## Plugin Features Guide

### 🌙 Dark Mode
Click the **🌙 Dark** button to toggle between light and dark themes. This provides better visibility in different lighting conditions.

### ⛶ Fullscreen Mode
Click the **⛶ Fullscreen** button to expand the editor to full screen for focused, distraction-free editing.

### </> Code View
Click the **</> Code** button to toggle between:
- **Visual Editor**: WYSIWYG editing experience
- **HTML Source**: Direct HTML code editing for advanced users

### ⊞ Tables
Click the **⊞** button in the toolbar to insert a 3x3 table. Right-click on any cell to:
- Insert rows above/below
- Insert columns left/right
- Merge/unmerge cells
- Delete rows/columns/table

### ✨ Formula Support
The plugin includes full KaTeX support for mathematical formulas. Click the **formula** button (ƒ) in the toolbar to insert mathematical expressions like:
- Equations: `E = mc^2`
- Fractions: `\frac{a}{b}`
- Greek letters: `\alpha, \beta, \gamma`
- And much more!

### 💻 Syntax Highlighting
Code blocks automatically get syntax highlighting using highlight.js with the Atom One Dark theme, supporting dozens of programming languages.

## Technical Details

### Dependencies
- **Quill**: Modern WYSIWYG editor (v2.0+)
- **quill-better-table**: Advanced table management
- **highlight.js**: Syntax highlighting for code blocks
- **katex**: Mathematical formula rendering
- **@builder.io/react**: Builder.io React SDK
- **@builder.io/app-context**: Builder.io app context

### Browser Compatibility
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Customization

To customize the plugin, edit `src/plugin.jsx`:

- **Toolbar Options**: Modify the `toolbarOptions` array
- **Font Sizes**: Edit the `Size.whitelist` array
- **Font Families**: Edit the `Font.whitelist` array
- **Styling**: Adjust the `containerStyles` CSS-in-JS

## Troubleshooting

### Plugin Not Loading
1. Verify the development server is running on port 1268
2. Check browser console for errors
3. Ensure you've allowed insecure scripts in Chrome (see installation notes)

### Table Features Not Working
1. Ensure `quill-better-table` is installed: `npm install quill-better-table`
2. Check that the table module is registered in the plugin

### Styling Issues
1. Clear your browser cache
2. Rebuild the plugin: `npm run build`
3. Refresh Builder.io

## License

ISC

## Support

For issues or questions:
- Check the [Builder.io documentation](https://www.builder.io/c/docs)
- Review [Quill.js documentation](https://quilljs.com/docs/)
- Submit issues to your project repository
