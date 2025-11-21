# Global Sounding Balloons Tracker

An interactive web application to track global sounding balloons in real-time using Leaflet.js.

## Features

- Real-time balloon position tracking
- Historical trajectory visualization
- Marker clustering for better performance
- Interactive map controls
- Statistics dashboard

## Deployment Options

### Option 1: GitHub Pages (Recommended - Free & Easy)

1. Create a new GitHub repository
2. Push all files to the repository
3. Go to Settings > Pages
4. Select main branch and / (root) folder
5. Your site will be available at: `https://yourusername.github.io/repository-name`

**Note:** For CORS issues, you'll need to either:
- Use a CORS proxy service (see app.js modifications)
- Or deploy the proxy server separately (see Option 3)

### Option 2: Netlify (Free & Easy)

1. Go to [netlify.com](https://netlify.com)
2. Sign up/login
3. Drag and drop the project folder
4. Your site will be live immediately!

### Option 3: Vercel (Free & Easy)

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the project directory
3. Follow the prompts
4. Your site will be deployed!

## Running Locally

1. Start the proxy server: `node proxy-server.js`
2. Open `index.html` in a browser or use a local server:
   ```bash
   python3 -m http.server 8000
   ```
3. Visit `http://localhost:8000`

## Files

- `index.html` - Main HTML file
- `app.js` - Application logic
- `proxy-server.js` - CORS proxy server (for local development)
- `test.html` - Test page for debugging

