# Google Maps API Error Troubleshooting Guide

## Common Errors and Solutions

### 1. "Map is initialized without a valid Map ID" Warning

**What it means:** You're trying to use Advanced Markers without a Map ID configured.

**Solution:**

```bash
# Add this to your .env file:
VITE_GOOGLE_MAPS_MAP_ID=your_map_id_here
```

**How to get a Map ID:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to Google Maps → Map Styles
3. Create a new map style or use an existing one
4. Copy the Map ID from the style details

**Note:** Map ID is **optional**. If not provided, the app will automatically use regular markers instead of Advanced Markers.

### 2. "ApiProjectMapError"

**What it means:** Your Google Cloud project configuration has issues.

**Solutions:**

#### Check API Key Configuration:

```bash
# Ensure your .env file has:
VITE_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
```

#### Verify API Permissions:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Services → Library
3. Ensure these APIs are enabled:
   - Maps JavaScript API
   - Places API
   - Geocoding API

#### Check API Key Restrictions:

1. Go to APIs & Services → Credentials
2. Click on your API key
3. Under "Application restrictions":
   - For development: Choose "None" or "HTTP referrers" with `localhost:*`
   - For production: Add your domain
4. Under "API restrictions":
   - Select "Restrict key"
   - Enable the required APIs listed above

### 3. "Failed to load Google Maps API"

**Solutions:**

1. **Check internet connectivity**
2. **Verify API key is valid:**
   ```bash
   # Test your API key:
   curl "https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY"
   ```
3. **Check browser console for specific error messages**
4. **Ensure you haven't exceeded quota limits**

### 4. Maps Not Displaying

**Solutions:**

1. **Check API key in environment:**
   ```javascript
   console.log("API Key:", import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
   ```
2. **Verify the container element exists**
3. **Check CSS styling - ensure map container has dimensions**
4. **Check browser developer tools for JavaScript errors**

## Environment Configuration

### Required Environment Variables

```bash
# .env file
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
VITE_GOOGLE_MAPS_MAP_ID=your_map_id_here  # Optional for Advanced Markers
```

### Validation Script

Add this to check your configuration:

```javascript
// Check in browser console
const config = {
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID,
};

console.log("Google Maps Configuration:", config);

if (!config.apiKey) {
  console.error("❌ Google Maps API key not configured");
} else {
  console.log("✅ Google Maps API key configured");
}

if (!config.mapId) {
  console.warn("⚠️ Map ID not configured - using regular markers");
} else {
  console.log("✅ Map ID configured - Advanced Markers available");
}
```

## Quota and Billing

### Check Usage:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Services → Quotas
3. Filter by "Maps JavaScript API"

### Common Quota Issues:

- **Requests per day exceeded:** Increase quotas or upgrade billing
- **Requests per minute exceeded:** Implement request throttling
- **No billing account:** Set up billing in Cloud Console

## Application Behavior

### With Map ID Configured:

- ✅ Uses Advanced Markers with enhanced features
- ✅ Modern marker styling and interactions
- ✅ Better performance and visual effects

### Without Map ID:

- ✅ Uses regular Google Maps markers (legacy)
- ✅ All basic functionality works
- ⚠️ No Advanced Marker features
- ✅ Automatic fallback - no errors

## Testing Your Setup

### 1. Basic API Test:

```html
<!DOCTYPE html>
<html>
  <head>
    <script>
      function initMap() {
        new google.maps.Map(document.getElementById("map"), {
          center: { lat: 28.6139, lng: 77.209 },
          zoom: 10,
        });
      }
    </script>
  </head>
  <body>
    <div id="map" style="height: 400px; width: 100%;"></div>
    <script
      async
      defer
      src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&callback=initMap"
    ></script>
  </body>
</html>
```

### 2. Advanced Markers Test:

```javascript
// Only works with Map ID
const map = new google.maps.Map(element, {
  mapId: "YOUR_MAP_ID",
  center: { lat: 28.6139, lng: 77.209 },
  zoom: 10,
});

const marker = new google.maps.marker.AdvancedMarkerElement({
  map,
  position: { lat: 28.6139, lng: 77.209 },
});
```

## Support Resources

- [Google Maps JavaScript API Documentation](https://developers.google.com/maps/documentation/javascript)
- [Google Maps Error Reference](https://developers.google.com/maps/documentation/javascript/error-messages)
- [API Key Best Practices](https://developers.google.com/maps/api-security-best-practices)
- [Billing and Pricing](https://developers.google.com/maps/billing-and-pricing)

## Getting Help

If you're still experiencing issues:

1. **Check browser console** for specific error messages
2. **Verify your Google Cloud Console** setup step by step
3. **Test with a simple HTML page** first
4. **Check Stack Overflow** for similar issues
5. **Contact Google Cloud Support** for billing/quota issues

Remember: The application is designed to work gracefully whether you have a Map ID configured or not. Advanced Markers are an enhancement, not a requirement.
