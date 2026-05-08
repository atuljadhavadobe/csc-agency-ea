# Navigation Setup Plan

## Overview
Set up navigation (header nav) and a simple footer for this AEM Edge Delivery Services site using the "My Blog" example structure:
- **Brand:** My Blog
- **Nav Links:** Home, Articles, Categories (with sub-items: Tech, Design, Life), About
- **Footer:** Simple copyright/brand footer

## How Navigation Works in EDS
The header block loads a `nav.html` fragment file, and the footer block loads a `footer.html` fragment file. These content files define the navigation structure using standard HTML markup that the existing header/footer blocks decorate.

The nav fragment expects three sections (separated by `---`):
1. **Brand** — logo or site name link
2. **Sections** — navigation links (nested `<ul>` for dropdowns)
3. **Tools** — optional CTA or utility links

## Checklist

- [ ] Create `content/nav.html` — Navigation fragment with brand ("My Blog"), links (Home, Articles, Categories with Tech/Design/Life sub-items, About)
- [ ] Create `content/footer.html` — Simple footer with copyright text
- [ ] Verify rendering — Check that the header and footer display correctly in preview

## File Details

### `content/nav.html`
Will contain three sections:
1. Brand section with "My Blog" as a link to home
2. Navigation sections with the menu structure including the Categories dropdown
3. Tools section (empty or with a simple CTA)

### `content/footer.html`
Will contain a simple section with:
- Copyright line (e.g., "© 2026 My Blog. All rights reserved.")

## Prerequisites
- The header (`blocks/header/`) and footer (`blocks/footer/`) blocks already exist with full decoration logic
- The fragment block (`blocks/fragment/`) is available for loading these content files
- No code changes are needed — only content files need to be created

## Execution
Execution requires exiting Plan mode. The navigation expert skill will be used to generate properly formatted nav and footer HTML files.
