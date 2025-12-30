# BSB Bible Reading Plan & Audiobook Generator

A client-side static web application to generate custom Bible reading plans as EPUB files and daily concatenated Audiobooks using the Berean Standard Bible (BSB) source files.

## Features

- **Custom Selection**: Choose specific books or use presets (Gospels, Pentateuch, etc.).
- **Flexible Scheduling**:
  - **Mixed Mode**: Read Old Testament, New Testament, Psalms, and Proverbs simultaneously.
  - **Sequential Mode**: Read through the selected books in order.
  - **Specific Reading Days**: Choose which days of the week you want to read.
  - **Date Support**: Toggle between dated plans and simple "Day 1, Day 2" plans.
- **Audiobook Generation**:
  - **Daily Concatenation**: Automatically joins all chapters for a day into a single MP3 file.
  - **Informative Naming**: Files are named with day numbers, dates (if enabled), and chapter summaries for easy navigation.
  - **High Performance**: Downloads and processes multiple days in parallel.
- **Advanced Padding**: Option to repeat shorter sections (like the New Testament) to maintain a daily rhythm until the longer sections (like the Old Testament) are finished.
- **Daily Summaries**: Each day in the EPUB starts with a summary page listing all chapters for that day.
- **Clean XHTML**: Generates valid XHTML 1.1 files for maximum compatibility with EPUB readers.
- **Privacy Focused**: Everything happens in your browser. No data is sent to a server.

## Browser Support

- **EPUB Generation**: Supported in all modern browsers (Chrome, Edge, Firefox, Safari).
- **Audiobook Generation**: Requires the **File System Access API**, which is currently only supported in **Chrome** and **Edge**. Firefox and Safari users can still generate EPUB plans but will not be able to generate audiobooks.

## Project Structure

- \`src/app.js\`: Main Preact application logic, EPUB generation, and Audiobook assembly.
- \`src/bibleData.js\`: Metadata for Bible books (chapter counts, file mapping).
- \`audio_processed/\`: Optimized MP3 bitstreams for client-side concatenation.
- \`bsb_unzipped/\`: Pre-processed BSB source files (headers/navigation removed).
- \`dist/\`: Built application files ready for hosting.
- \`index.html\`: Entry point for the web application.

## Hosting & Deployment

This project is a fully static web application. Since the pre-processed source files and built JS are included in the repository, you can host it directly using services like GitHub Pages, Vercel, or Netlify without any additional build steps.

Simply point your hosting provider to the root directory.

## Development

If you wish to modify the application:

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the application after making changes:
   ```bash
   npm run build
   ```

## License

- **Source Code**: This project's source code is licensed under the [MIT License](LICENSE).
- **Bible Text**: The [Berean Standard Bible](https://berean.bible/) (BSB) is public domain. No license is required to use or distribute the generated EPUBs.
- **Bible Audio**: The audio recording is by Barry Hays and has also been placed in the public domain.
