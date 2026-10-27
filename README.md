# BookVault

A premium midnight-navy and gold personal book library. This is a lightweight installable PWA built with vanilla HTML, CSS and JavaScript.

## Features
- Search Google Books and Open Library for book metadata and real cover images.
- Review matching editions and choose the one closest to your copy.
- Save title, author, genre, publication year, description, cover, ISBN, and reading status.
- Search your saved collection by title, author, genre, or description.
- Filter by All Books, Currently Reading, Finished, and Want to Read.
- Duplicate warning for likely title/author matches.
- Edit or remove a book via the `⋯` menu on a book card.
- Export and import a JSON backup.
- Local persistence with `localStorage`.
- Responsive layout and PWA shell caching for repeat/offline opening.

## Run locally
PWA service workers require localhost or HTTPS. Do not open `index.html` directly with `file://`.

### Option A — Python
1. Unzip the folder.
2. Open a terminal in the `bookvault` folder.
3. Run:
   ```bash
   python -m http.server 8080
   ```
4. Open `http://localhost:8080`.

### Option B — Node
If Node.js is installed:
```bash
npx serve .
```
Open the local URL shown in the terminal.

## Put it on your phone
To install on your own phone, host the folder on an HTTPS static host such as GitHub Pages, Netlify, or Vercel.

- **Android / Chrome:** open the HTTPS URL, then choose **Install app** or **Add to Home screen**.
- **iPhone / Safari:** open the HTTPS URL, tap **Share**, then **Add to Home Screen**.

On iPhone, use Safari for the most reliable Add to Home Screen flow. The browser may not show a custom install prompt; the Share menu remains the fallback.

## Book lookup notes
- Google Books API: `https://www.googleapis.com/books/v1/volumes`
- Open Library Search API: `https://openlibrary.org/search.json`
- Open Library covers: `https://covers.openlibrary.org/`

Book cover and metadata availability depends on the catalogue. Different printings can have different covers, so check the result details before saving. If the cover is missing, BookVault uses a tasteful placeholder and lets you save the book manually.

## Data and privacy
- The collection is stored in the browser's `localStorage` on the device/browser profile that you use.
- There is no login or cloud sync in this first version.
- Clearing browser site data may erase the collection. Use **Export library backup** regularly and keep the JSON file somewhere safe.
- Internet is required for online catalogue lookup and remote cover images. Previously cached app files can open offline, but catalogue search cannot.
- Use the app on the same browser/profile to see the same locally stored collection. Hosting the app does not automatically synchronize data between devices.

## Known limitations / future improvements
- ISBN barcode scanning is not included in this first version.
- Book actions are kept deliberately simple; choose a book card's `⋯` menu to change status, edit, or delete.
- Catalogue data can include duplicates or inaccurate edition metadata; manual corrections are supported.
- For multi-device syncing, add an authenticated backend such as Supabase or Firebase.
