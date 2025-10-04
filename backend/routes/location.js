const express = require("express");
const router = express.Router();

// Enhanced logging
const log = (message, data = "") => {
  console.log(`[LOCATION] ${new Date().toISOString()} - ${message}`, data);
};

// Geocode coordinates to address using query parameters (safer than path parameters)

// Replacement geocode route using query parameters
router.get("/geocode", async (req, res) => {
  try {
    const { lat, lng } = req.query;
    log(`Geocoding request for coordinates: ${lat}, ${lng}`);

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude query parameters are required",
      });
    }

    // Validate coordinates
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coordinates provided",
      });
    }

    if (
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({
        success: false,
        message: "Coordinates out of valid range",
      });
    }

    // Try OpenStreetMap Nominatim API for reverse geocoding
    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16&addressdetails=1`;

      const response = await fetch(nominatimUrl, {
        headers: {
          "User-Agent": "CleanCare-Pro/1.0",
        },
      });

      if (response.ok) {
        const data = await response.json();

        if (data && data.address) {
          // Extract meaningful address components
          const address = data.address;
          let formattedAddress = "";
          let cityName = "";

          // Build city name
          const city = address.city || address.town || address.village;
          const locality =
            address.suburb || address.neighbourhood || address.quarter;
          const state = address.state;

          if (city) {
            cityName = city;
            if (state && state !== city) {
              cityName += `, ${state}`;
            }
          } else if (locality) {
            cityName = locality;
            if (state && state !== locality) {
              cityName += `, ${state}`;
            }
          } else if (state) {
            cityName = state;
          }

          // Build formatted address
          const components = [
            address.house_number,
            address.road,
            locality,
            city,
            state,
            address.country,
          ].filter(Boolean);

          formattedAddress = components.join(", ");

          log(`Geocoding successful: ${cityName}`);

          return res.json({
            success: true,
            data: {
              address: formattedAddress || data.display_name,
              city: cityName,
              components: address,
              display_name: data.display_name,
              coordinates: {
                lat: latitude,
                lng: longitude,
              },
            },
          });
        }
      }
    } catch (nominatimError) {
      log(`Nominatim API error: ${nominatimError.message}`);
    }

    // Fallback response
    log(`Geocoding fallback for: ${latitude}, ${longitude}`);
    res.json({
      success: true,
      data: {
        address: `Location at ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        city: "Unknown Location",
        coordinates: {
          lat: latitude,
          lng: longitude,
        },
      },
    });
  } catch (error) {
    log(`Geocoding error: ${error.message}`, error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to geocode location",
    });
  }
});

// Search for places/addresses
router.get("/search/:query", async (req, res) => {
  try {
    const { query } = req.params;
    log(`Location search request: ${query}`);

    if (!query || query.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 3 characters long",
      });
    }

    // Use Nominatim for place search
    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&countrycodes=in&addressdetails=1`;

      const response = await fetch(nominatimUrl, {
        headers: {
          "User-Agent": "CleanCare-Pro/1.0",
        },
      });

      if (response.ok) {
        const data = await response.json();

        const results = data.map((item) => ({
          display_name: item.display_name,
          address: item.address,
          coordinates: {
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
          },
          type: item.type,
          importance: item.importance,
        }));

        log(`Search found ${results.length} results`);

        return res.json({
          success: true,
          data: {
            query,
            results,
            count: results.length,
          },
        });
      }
    } catch (searchError) {
      log(`Search API error: ${searchError.message}`);
    }

    // Fallback response
    res.json({
      success: true,
      data: {
        query,
        results: [],
        count: 0,
      },
    });
  } catch (error) {
    log(`Search error: ${error.message}`, error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to search locations",
    });
  }
});

// Get service areas (mock data for now)
router.get("/service-areas", (req, res) => {
  try {
    log("Service areas request");

    const serviceAreas = [
      {
        id: "delhi",
        name: "Delhi NCR",
        cities: ["New Delhi", "Gurgaon", "Noida", "Faridabad", "Ghaziabad"],
        coordinates: {
          lat: 28.6139,
          lng: 77.209,
        },
      },
      {
        id: "mumbai",
        name: "Mumbai",
        cities: ["Mumbai", "Navi Mumbai", "Thane", "Pune"],
        coordinates: {
          lat: 19.076,
          lng: 72.8777,
        },
      },
      {
        id: "bangalore",
        name: "Bangalore",
        cities: ["Bangalore", "Mysore"],
        coordinates: {
          lat: 12.9716,
          lng: 77.5946,
        },
      },
      {
        id: "hyderabad",
        name: "Hyderabad",
        cities: ["Hyderabad", "Secunderabad"],
        coordinates: {
          lat: 17.385,
          lng: 78.4867,
        },
      },
    ];

    res.json({
      success: true,
      data: {
        serviceAreas,
        count: serviceAreas.length,
      },
    });
  } catch (error) {
    log(`Service areas error: ${error.message}`, error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to get service areas",
    });
  }
});

// Check if location is in service area
router.post("/check-service-area", (req, res) => {
  try {
    const { lat, lng } = req.body;
    log(`Service area check for: ${lat}, ${lng}`);

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coordinates",
      });
    }

    // Simple check - for now, assume all of India is in service area
    const isInIndia =
      latitude >= 6.0 &&
      latitude <= 37.0 &&
      longitude >= 68.0 &&
      longitude <= 97.0;

    res.json({
      success: true,
      data: {
        inServiceArea: isInIndia,
        coordinates: {
          lat: latitude,
          lng: longitude,
        },
        message: isInIndia
          ? "Location is in service area"
          : "Location is outside service area",
      },
    });
  } catch (error) {
    log(`Service area check error: ${error.message}`, error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to check service area",
    });
  }
});

// Health check for location service
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Location service is healthy",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
