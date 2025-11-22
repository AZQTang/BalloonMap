// Production version - uses CORS proxy
// Copy this to app.js for production deployment

// Initialize map centered on world view
const map = L.map("map").setView([20, 0], 2);

// Add OpenStreetMap tile layer
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
}).addTo(map);

// Storage for markers and trajectories
let markers = [];
let markerClusterGroup = null;
let trajectoryLayers = [];
let trajectoryLayerGroup = null;
let showTrajectories = true;
let showMarkers = true;
let balloonData = {}; // Store data by hour: {0: [...], 1: [...], ...}

// Custom balloon icon
const balloonIcon = L.divIcon({
  className: "balloon-marker",
  html: '<div style="background: #e74c3c; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

// CORS Proxy - use a public CORS proxy service
const CORS_PROXY = "https://api.allorigins.win/raw?url=";

// Robust JSON parsing with error handling
function parseJSON(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    // Try to repair common JSON issues
    try {
      // Remove trailing commas
      let repaired = text.replace(/,(\s*[}\]])/g, "$1");
      // Try to close unclosed arrays/objects
      const openBraces = (repaired.match(/\{/g) || []).length;
      const closeBraces = (repaired.match(/\}/g) || []).length;
      const openBrackets = (repaired.match(/\[/g) || []).length;
      const closeBrackets = (repaired.match(/\]/g) || []).length;

      if (openBraces > closeBraces) {
        repaired += "}".repeat(openBraces - closeBraces);
      }
      if (openBrackets > closeBrackets) {
        repaired += "]".repeat(openBrackets - closeBrackets);
      }

      return JSON.parse(repaired);
    } catch (e2) {
      console.warn("Failed to parse JSON:", e2);
      return null;
    }
  }
}

// Fetch data from a specific hour endpoint
async function fetchHourData(hoursAgo) {
  const paddedHour = hoursAgo.toString().padStart(2, "0");
  const originalUrl = `https://a.windbornesystems.com/treasure/${paddedHour}.json`;
  // Use CORS proxy for production
  const url = CORS_PROXY + encodeURIComponent(originalUrl);

  try {
    console.log(`Fetching data from ${originalUrl}...`);
    const response = await fetch(url, {
      method: "GET",
      mode: "cors",
      cache: "no-cache",
    });

    console.log(
      `Response status for ${paddedHour}.json:`,
      response.status,
      response.statusText
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `HTTP ${response.status}: ${response.statusText}. ${errorText.substring(
          0,
          100
        )}`
      );
    }

    const text = await response.text();
    console.log(`Received ${text.length} characters from ${paddedHour}.json`);

    if (!text || text.trim().length === 0) {
      console.warn(`Empty response from ${paddedHour}.json`);
      return null;
    }

    const data = parseJSON(text);
    if (!data) {
      console.warn(`Failed to parse JSON from ${paddedHour}.json`);
      console.warn(`First 200 chars of response:`, text.substring(0, 200));
      return null;
    }

    if (!Array.isArray(data)) {
      console.warn(
        `Data from ${paddedHour}.json is not an array:`,
        typeof data
      );
      return null;
    }

    console.log(
      `Successfully parsed ${data.length} balloons from ${paddedHour}.json`
    );
    return data;
  } catch (error) {
    console.error(
      `Failed to fetch data from ${hoursAgo} hours ago (${paddedHour}.json):`,
      error
    );
    // Log full error details
    if (
      error.name === "TypeError" &&
      error.message.includes("Failed to fetch")
    ) {
      console.error(
        "This might be a CORS issue. Check browser console for CORS errors."
      );
    }
    return null;
  }
}

// Update status message
function updateStatus(message, type = "") {
  const statusEl = document.getElementById("status");
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

// Clear all markers and trajectories
function clearMap() {
  if (markerClusterGroup) {
    map.removeLayer(markerClusterGroup);
    markerClusterGroup = null;
  }
  markers = [];

  if (trajectoryLayerGroup) {
    map.removeLayer(trajectoryLayerGroup);
    trajectoryLayerGroup = null;
  }
  trajectoryLayers = [];

  balloonData = {};
  updateStats();
}

// Update statistics panel
function updateStats() {
  const totalBalloons = balloonData[0] ? balloonData[0].length : 0;
  const markerCount = markerClusterGroup
    ? markerClusterGroup.getLayers().length
    : markers.length;
  const trajectoryCount = trajectoryLayers.length;
  const zoomLevel = map.getZoom();

  document.getElementById("totalBalloons").textContent = totalBalloons;
  document.getElementById("visibleMarkers").textContent = markerCount;
  document.getElementById("trajectoryCount").textContent = trajectoryCount;
  document.getElementById("zoomLevel").textContent = zoomLevel;
}

// Load all balloon data
async function loadBalloonData() {
  updateStatus("Loading balloon data...", "loading");
  clearMap();

  const loadPromises = [];
  for (let hour = 0; hour <= 23; hour++) {
    loadPromises.push(
      fetchHourData(hour)
        .then((data) => {
          if (data && Array.isArray(data)) {
            balloonData[hour] = data;
            console.log(
              `Loaded ${data.length} balloons from ${hour} hours ago`
            );
          }
        })
        .catch((error) => {
          console.warn(`Error loading hour ${hour}:`, error);
        })
    );
  }

  await Promise.all(loadPromises);

  const availableHours = Object.keys(balloonData).length;
  const currentBalloons = balloonData[0] ? balloonData[0].length : 0;

  console.log(
    `Data loading complete. Available hours: ${availableHours}, Current balloons: ${currentBalloons}`
  );
  console.log(`Balloon data keys:`, Object.keys(balloonData));

  if (availableHours === 0) {
    updateStatus("Failed to load any data. Check console for errors.", "error");
    console.error("No data loaded from any time point. Possible issues:");
    console.error("1. CORS blocking - check browser console for CORS errors");
    console.error("2. Network issues - check internet connection");
    console.error("3. API server issues - verify API is accessible");
    return;
  }

  updateStatus(
    `Loaded ${currentBalloons} balloons from ${availableHours} time points`,
    ""
  );

  // Display current positions (hour 0)
  if (balloonData[0] && balloonData[0].length > 0) {
    console.log(`Displaying ${balloonData[0].length} current positions`);
    displayCurrentPositions(balloonData[0]);

    // Fit map to show all balloons
    if (markerClusterGroup && markerClusterGroup.getLayers().length > 0) {
      map.fitBounds(markerClusterGroup.getBounds().pad(0.1));
    } else {
      console.warn("No markers were created despite having data");
      updateStatus("Data loaded but no valid markers created", "error");
    }
  } else {
    updateStatus("No current balloon data available (hour 0)", "error");
    console.error("No current balloon data found in balloonData[0]");
    console.error("Available hours:", Object.keys(balloonData));
    if (availableHours > 0) {
      const firstHour = Object.keys(balloonData).sort()[0];
      console.log(`Showing data from ${firstHour} hours ago instead`);
      if (balloonData[firstHour] && balloonData[firstHour].length > 0) {
        displayCurrentPositions(balloonData[firstHour]);
        if (markers.length > 0) {
          const group = new L.featureGroup(markers);
          map.fitBounds(group.getBounds().pad(0.1));
        }
      }
    }
  }

  // Display trajectories if enabled
  if (showTrajectories) {
    displayTrajectories();
  }
}

// Display current balloon positions with clustering
function displayCurrentPositions(data) {
  // Remove existing cluster group if any
  if (markerClusterGroup) {
    map.removeLayer(markerClusterGroup);
  }

  // Create new marker cluster group
  markerClusterGroup = L.markerClusterGroup({
    chunkedLoading: true,
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
  });

  let validCount = 0;
  let invalidCount = 0;

  data.forEach((balloon, index) => {
    if (!balloon || !Array.isArray(balloon) || balloon.length < 2) {
      invalidCount++;
      return;
    }

    const lat = balloon[0];
    const lon = balloon[1];
    const alt = balloon.length > 2 ? balloon[2] : "N/A";

    // Validate coordinates
    if (
      typeof lat !== "number" ||
      typeof lon !== "number" ||
      isNaN(lat) ||
      isNaN(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      invalidCount++;
      return;
    }

    try {
      const marker = L.marker([lat, lon], { icon: balloonIcon }).bindPopup(`
                  <strong>Balloon #${index + 1}</strong><br>
                  Position: ${lat.toFixed(4)}°, ${lon.toFixed(4)}°<br>
                  ${alt !== "N/A" ? `Altitude: ${alt.toFixed(2)} km<br>` : ""}
                  Time: Current
              `);

      markerClusterGroup.addLayer(marker);
      markers.push(marker);
      validCount++;
    } catch (error) {
      console.error(`Error creating marker at index ${index}:`, error);
      invalidCount++;
    }
  });

  // Add cluster group to map if markers are enabled
  if (showMarkers && markerClusterGroup.getLayers().length > 0) {
    map.addLayer(markerClusterGroup);
  }

  console.log(
    `Displayed ${validCount} markers, skipped ${invalidCount} invalid entries`
  );
  updateStats();
}

// Display trajectories by matching balloons across time
function displayTrajectories() {
  // Remove existing trajectory layer group
  if (trajectoryLayerGroup) {
    map.removeLayer(trajectoryLayerGroup);
  }

  if (!showTrajectories) {
    trajectoryLayers = [];
    updateStats();
    return;
  }

  // Create a layer group for trajectories
  trajectoryLayerGroup = L.layerGroup();

  // Get all available hours sorted
  const hours = Object.keys(balloonData)
    .map((h) => parseInt(h))
    .sort((a, b) => a - b); // Oldest first for proper trajectory order

  if (hours.length < 2) {
    updateStats();
    return; // Need at least 2 time points for trajectories
  }

  // Try to match balloons by index (assuming same order)
  const maxBalloons = Math.max(
    ...hours.map((h) => balloonData[h]?.length || 0)
  );

  for (let balloonIndex = 0; balloonIndex < maxBalloons; balloonIndex++) {
    const trajectory = [];

    // Collect positions for this balloon across all hours
    for (const hour of hours) {
      const hourData = balloonData[hour];
      if (hourData && hourData[balloonIndex]) {
        const balloon = hourData[balloonIndex];
        if (Array.isArray(balloon) && balloon.length >= 2) {
          const lat = balloon[0];
          const lon = balloon[1];

          // Validate coordinates
          if (
            typeof lat === "number" &&
            typeof lon === "number" &&
            !isNaN(lat) &&
            !isNaN(lon) &&
            lat >= -90 &&
            lat <= 90 &&
            lon >= -180 &&
            lon <= 180
          ) {
            trajectory.push([lat, lon]);
          }
        }
      }
    }

    // Draw trajectory if we have at least 2 points
    if (trajectory.length >= 2) {
      // Initial style - will be updated by updateTrajectoryVisibility
      const polyline = L.polyline(trajectory, {
        color: "#3498db",
        weight: 1,
        opacity: 0.3,
        smoothFactor: 1,
      });

      trajectoryLayerGroup.addLayer(polyline);
      trajectoryLayers.push(polyline);
    }
  }

  // Add trajectory layer group to map
  if (trajectoryLayerGroup.getLayers().length > 0) {
    map.addLayer(trajectoryLayerGroup);
    // Update trajectory visibility based on current zoom level
    updateTrajectoryVisibility();
  }

  updateStats();
}

// Toggle trajectories visibility
function toggleTrajectories() {
  showTrajectories = !showTrajectories;
  displayTrajectories();
}

// Toggle markers visibility
function toggleMarkers(shouldShow) {
  if (shouldShow !== undefined) {
    showMarkers = shouldShow;
  } else {
    showMarkers = !showMarkers;
  }

  if (markerClusterGroup) {
    if (showMarkers) {
      map.addLayer(markerClusterGroup);
    } else {
      map.removeLayer(markerClusterGroup);
    }
  }
  updateStats();
}

// Event listeners
document.getElementById("loadBtn").addEventListener("click", loadBalloonData);
document.getElementById("clearBtn").addEventListener("click", () => {
  clearMap();
  updateStatus("Map cleared", "");
});

// Layer control checkboxes
document
  .getElementById("toggleTrajectories")
  .addEventListener("change", (e) => {
    showTrajectories = e.target.checked;
    displayTrajectories();
  });

document.getElementById("toggleMarkers").addEventListener("change", (e) => {
  toggleMarkers(e.target.checked);
});

// Update stats and trajectory visibility on zoom
map.on("zoom", () => {
  updateStats();
  updateTrajectoryVisibility();
});

map.on("zoomend", () => {
  updateStats();
  updateTrajectoryVisibility();
});

map.on("moveend", updateStats);

// Update trajectory visibility based on zoom level
function updateTrajectoryVisibility() {
  if (
    !trajectoryLayerGroup ||
    !showTrajectories ||
    trajectoryLayers.length === 0
  )
    return;

  const zoom = map.getZoom();

  // More dramatic weight changes: from 1px at low zoom to 5px at high zoom
  let weight, opacity;

  if (zoom < 3) {
    weight = 1;
    opacity = 0.2;
  } else if (zoom < 5) {
    weight = 1.5;
    opacity = 0.25;
  } else if (zoom < 7) {
    weight = 2;
    opacity = 0.3;
  } else if (zoom < 9) {
    weight = 3;
    opacity = 0.4;
  } else if (zoom < 11) {
    weight = 4;
    opacity = 0.5;
  } else {
    weight = 5;
    opacity = 0.6;
  }

  trajectoryLayers.forEach((polyline) => {
    polyline.setStyle({
      opacity: opacity,
      weight: weight,
    });
  });
}

// Auto-load on page load
window.addEventListener("load", () => {
  loadBalloonData();
});

// Auto-refresh every 5 minutes
setInterval(() => {
  if (markers.length > 0) {
    loadBalloonData();
  }
}, 5 * 60 * 1000);

