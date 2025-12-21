# **App Name**: MuPractice

## Core Features:

- Test Library: A searchable and filterable library of Mu Alpha Theta tests based on division, year, month, and competition type, displaying test names as '{year} {division} {month} {test_type} Individual'.
- PDF Viewer: Embed a PDF viewer using Google Docs Viewer proxy for test display, with a full-screen toggle feature.
- Digital Scantron: A scrollable, digital scantron form with clearly labeled answer buttons (A-E) and Clear option, storing selections locally.
- Automated Scoring: Automatically grade tests upon submission based on provided solutions: +5 for correct, 0 for incorrect, +1 for blank.
- Score Report: Display a report card overlay showing the total score out of 150, with breakdowns of correct, incorrect, and omit counts.
- Review Mode: Highlight the digital scantron in green (correct), red (wrong), and yellow (omitted) in review mode.
- Firestore Integration for Leaderboard: Submit test scores, test name, and username to Firestore upon submission. Not implemented for MVP.

## Style Guidelines:

- Primary color: Muted classroom blue (#7CB9E8) to evoke a sense of learning and focus.
- Background color: Deep Slate (#0f172a) for a modern, academic feel.
- Accent color: High-contrast white (#FFFFFF) for text and key UI elements to ensure readability.
- Body and headline font: 'Inter', a grotesque-style sans-serif with a modern, machined, objective, neutral look suitable for both headlines and body text.
- Code font: 'Source Code Pro' for displaying code snippets.
- Use clean, minimalist icons for navigation and interactive elements.
- Split-screen layout for the Practice Arena, allowing users to adjust the size of the PDF viewer and Digital Scantron panels.