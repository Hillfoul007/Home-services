# Google Maps API Migration Guide

## Migration to New Places API

This project has been updated to use the new Google Maps Places API instead of the deprecated `PlacesService`. The migration addresses the following deprecation warning:

```
"As of March 1st, 2025, google.maps.places.PlacesService is not available to new customers. Please use google.maps.places.Place instead."
```

## Changes Made

### 1. Updated AutocompleteSuggestionService (`src/utils/autocompleteSuggestionService.ts`)

- **Before**: Used `google.maps.places.PlacesService` for place details
- **After**: Uses new `google.maps.places.Place` API with fallback to legacy API
- **Benefits**: Future-proof implementation with backward compatibility

### 2. Enhanced ModernGoogleMaps (`src/utils/modernGoogleMaps.ts`)

- Added proper Map ID configuration to prevent Advanced Markers warnings
- Added console warnings for missing Map ID configuration
- Improved error handling and logging

### 3. Updated Components

The following components were updated to use the new API:

- `ZomatoAddAddressPage.tsx` - Place details and nearby search
- `EnhancedAddressForm.tsx` - Address autocomplete
- `LocationDetector.tsx` - Location selection

## Environment Configuration

### Required Environment Variables

```bash
# Google Maps API Key (Required)
VITE_GOOGLE_MAPS_API_KEY=your_api_key_here

# Google Maps Map ID (Optional - for Advanced Markers)
VITE_GOOGLE_MAPS_MAP_ID=your_map_id_here
```

### Map ID (Optional)

The system now works **without requiring a Map ID**. Here's how it handles different scenarios:

- **With Map ID**: Uses Advanced Markers for enhanced visual features
- **Without Map ID**: Falls back to regular Google Maps markers automatically

**Note**: Map ID is completely optional. The system will automatically detect if a Map ID is available and use the appropriate marker type.

## API Features Used

### New Places API Features

- `google.maps.places.Place` - Modern place details API
- `google.maps.places.AutocompleteSuggestion` - Enhanced autocomplete
- `google.maps.places.Place.searchByText` - Text-based place search

### Backward Compatibility

- Legacy `PlacesService` is still used as fallback when new API fails
- Existing code interfaces remain unchanged for seamless migration

## Error Handling

The migration includes comprehensive error handling:

1. **Primary**: Try new Places API
2. **Fallback**: Use legacy PlacesService if new API fails
3. **Final fallback**: Use geocoding service for basic location data

## Benefits of Migration

1. **Future-proof**: Uses the latest Google Maps API
2. **Better performance**: New API is optimized for modern web applications
3. **Enhanced features**: Access to newer place data and search capabilities
4. **Backward compatible**: Existing functionality preserved during transition

## Troubleshooting

### Common Issues

1. **Advanced Markers not displaying**
   - This is normal if no Map ID is configured
   - The system automatically uses regular markers as fallback

2. **Place details failing**
   - Solution: Check API key permissions and quota limits

3. **Maps not loading**
   - Solution: Verify `VITE_GOOGLE_MAPS_API_KEY` is set correctly

### Console Messages

The system provides helpful console messages for:

- Marker type being used (Advanced vs Regular)
- API initialization status
- Fallback usage notifications

## Testing

To verify the migration works correctly:

1. Test address autocomplete functionality
2. Verify place selection and details retrieval
3. Check map functionality with markers
4. Ensure error handling works when API fails

## Future Considerations

- Monitor Google's deprecation timeline for PlacesService
- Plan to remove legacy fallback code after transition period
- Consider upgrading to newer Maps API features as they become available
