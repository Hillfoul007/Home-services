# Admin Portal - Laundrify

## Overview
The Admin Portal provides comprehensive administrative functionality for the Laundrify laundry service platform. It allows administrators to manage bookings, create orders on behalf of users, and configure service locations.

## Features

### 🔐 Authentication
- Simple login system with configurable credentials
- Session management with automatic expiration
- Easily editable admin credentials in code

### 📊 Dashboard
- Overview statistics (bookings, users, revenue)
- Quick actions for common tasks
- Recent activity feed
- Real-time session information

### 📅 Booking Management
- View all customer bookings
- Search and filter bookings by status, date, customer
- Edit booking details (schedule, quantity, amount)
- Update booking status
- View detailed booking information

### 👥 User Booking
- Search for registered users by phone or name
- Create bookings on behalf of any user
- Add multiple services with custom pricing
- Set pickup/delivery schedules
- Apply discounts
- Complete address management

### 📍 Service Locations
- Manage service availability by:
  - Sectors (e.g., Sector 15, Sector 22)
  - Pin codes (e.g., 122001, 110001)
  - Keywords (e.g., DLF, Golf Course)
  - Areas (e.g., Cyber City, MG Road)
- Add, edit, and delete service locations
- Activate/deactivate locations
- Set priority levels
- Search and filter locations

## Access Instructions

### 1. Navigate to Admin Portal
Visit: `http://your-domain.com/admin`

### 2. Login Credentials
**Default credentials (easily changeable):**
- **Username:** `admin`
- **Password:** `admin123!`

### 3. Changing Admin Credentials
Edit the file: `src/config/adminConfig.ts`

```typescript
export const ADMIN_CONFIG = {
  // Admin Login Credentials (Change these as needed)
  USERNAME: "your-new-username",
  PASSWORD: "your-new-password",
  
  // Other settings...
};
```

## API Endpoints

### Admin Authentication
- **Frontend:** Session-based authentication with localStorage
- **Backend:** Admin routes accessible at `/api/admin/*`

### Available Endpoints
- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/bookings` - List all bookings with filters
- `PUT /api/admin/bookings/:id` - Update booking details
- `GET /api/admin/users/search` - Search users
- `POST /api/admin/bookings` - Create booking for user

## Security Features

### Session Management
- 8-hour session duration (configurable)
- Automatic logout on expiration
- Session validation on each action

### Access Control
- Admin-only routes protected
- User authentication verified
- Input validation and sanitization

### Data Protection
- Sensitive data filtering
- No password exposure in responses
- Secure admin session storage

## Technical Implementation

### Frontend Stack
- **React** with TypeScript
- **Tailwind CSS** for styling
- **Radix UI** components
- **React Router** for navigation
- **Sonner** for toast notifications

### Backend Integration
- **Express.js** API routes
- **MongoDB** data storage
- **Mongoose** ODM
- **CORS** configuration
- **Rate limiting** protection

### File Structure
```
src/
├── components/
│   ├── AdminLogin.tsx           # Login interface
│   ├── AdminDashboard.tsx       # Main dashboard
│   ├── AdminBookingManagement.tsx # Booking management
│   ├── AdminUserBooking.tsx     # User booking creation
│   └── AdminServiceLocations.tsx # Location management
├── config/
│   └── adminConfig.ts           # Admin configuration
└── pages/
    └── AdminPortal.tsx          # Main portal page

backend/
└── routes/
    └── admin.js                 # Admin API routes
```

## Usage Guidelines

### 1. Managing Bookings
1. Navigate to "Bookings" tab
2. Use search/filter to find specific bookings
3. Click "Edit" to modify booking details
4. Use quick status buttons for common updates
5. View detailed information with "View" button

### 2. Creating User Bookings
1. Go to "Book for User" tab
2. Search for user by phone number or name
3. Select user from search results
4. Add services (use quick buttons or custom entries)
5. Set pickup/delivery schedule
6. Enter complete address
7. Apply any discounts
8. Submit booking

### 3. Managing Service Locations
1. Access "Locations" tab
2. View current service areas by type
3. Add new locations with "Add Location" button
4. Edit existing locations as needed
5. Activate/deactivate service areas
6. Set priorities for location matching

## Troubleshooting

### Login Issues
- Verify credentials in `src/config/adminConfig.ts`
- Check browser console for errors
- Clear localStorage if session is corrupted

### API Errors
- Ensure backend server is running
- Check network connectivity
- Verify admin routes are registered in server

### Data Not Loading
- Check backend logs for errors
- Verify database connection
- Confirm API endpoints are accessible

## Development Notes

### Adding New Features
1. Create new components in `src/components/`
2. Add to main dashboard tabs
3. Implement corresponding backend routes
4. Update configuration as needed

### Customization
- Admin credentials: `src/config/adminConfig.ts`
- UI theme: Tailwind CSS classes
- Session duration: `ADMIN_CONFIG.SESSION_DURATION`
- Portal title: `ADMIN_CONFIG.PORTAL_TITLE`

### Security Considerations
- Change default admin credentials immediately
- Implement proper admin role validation in production
- Add IP restrictions if needed
- Enable HTTPS in production
- Consider two-factor authentication for enhanced security

## Support
For technical support or feature requests, contact the development team or refer to the main project documentation.
