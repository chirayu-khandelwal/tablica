# Tablica

<img src="src/img/128.png" width="128px"/>

Tablica is a browser extension for intelligent tab organization - sort, group, and deduplicate tabs with domain-first sorting.

## Features

1. **Smart Sorting** - Sort by domain, subdomain, main page, URL, title, or last access time
2. **System Tabs First** - Browser internal tabs (`chrome://`, `brave://`, etc.) always appear first
3. **Domain Grouping** - Keep related tabs together with proper domain detection (including `.in`, `.uk`, `.jp` TLDs)
4. **Tab Deduplication** - Remove duplicate tabs by URL or title
5. **Tab Groups** - Create and manage Chrome tab groups
6. **Undo Support** - Revert the last sort operation
7. **Auto-Sort** - Optional automatic sorting when tabs are created or navigated
8. **Suspended Tab Support** - Compatible with tab suspender extensions

### Sort Modes

| Mode | Description |
|------|-------------|
| **Domain** | Groups tabs by root domain (e.g., `google.com`, `github.com`) |
| **Subdomain** | Sorts by subdomain first (e.g., `a.google.com`, `b.google.com`) |
| **Main Page** | Groups by first path segment |
| **URL** | Full URL alphabetical sorting |
| **Title** | Sort by tab title |
| **Last Accessed** | Sort by recent activity |

## Installation

1. Clone this repo or download the source to your machine
2. Navigate to your browser's extensions page:
   - **Chrome/Chromium**: `chrome://extensions`
   - **Brave**: `brave://extensions`
   - **Edge**: `edge://extensions`
3. Enable **Developer mode** in the upper right corner
4. Click **Load unpacked** and select the `src` directory
5. The <img src="src/img/128.png" width="16px"/> icon will appear in your toolbar

## Usage

Click the Tablica icon in your browser toolbar to access:
- **Sort** - Organize tabs by your selected criteria
- **Dedup URL/Title** - Remove duplicate tabs
- **Group** - Create tab groups by domain
- **Pin/Mute** - Quick tab management
- **Navigate** - Jump between tabs quickly
- **Close** - Close tabs in bulk

Configure default behavior in Settings (gear icon).

## Fork

Tablica is a rebrand and enhancement of [Simple Tab Sorter](https://github.com/pwhite2/simple-tab-sorter) with focus on domain-first sorting and modern web extension APIs.

## License

GNU General Public License v3.0
