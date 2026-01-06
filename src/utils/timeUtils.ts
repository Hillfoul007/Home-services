/**
 * Utility functions for handling timestamps in Indian Standard Time (IST)
 */

/**
 * Get current date and time in IST
 * @returns Date object in IST
 */
export function getISTDate(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

/**
 * Get current timestamp in IST as ISO string
 * @returns ISO string in IST
 */
export function getISTTimestamp(): string {
  return getISTDate().toISOString();
}

/**
 * Get current timestamp for database saves (IST)
 * @returns Date object in IST
 */
export function getISTDateForDB(): Date {
  return getISTDate();
}

/**
 * Convert any date to IST
 * @param date Date to convert
 * @returns Date object in IST
 */
export function convertToIST(date: Date): Date {
  return new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

/**
 * Get Unix timestamp in IST
 * @returns Unix timestamp (milliseconds)
 */
export function getISTUnixTimestamp(): number {
  return getISTDate().getTime();
}

/**
 * Format date for Indian time display
 * @param date Date to format
 * @returns Formatted date string
 */
export function formatISTDate(date: Date): string {
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

/**
 * Check if timestamp is expired (utility function)
 * @param timestamp Timestamp to check
 * @param expiryDurationMs Expiry duration in milliseconds
 * @returns True if expired
 */
export function isTimestampExpired(timestamp: number | string, expiryDurationMs: number): boolean {
  const timestampMs = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
  return getISTUnixTimestamp() - timestampMs > expiryDurationMs;
}

/**
 * Format date in IST for display in Indian context
 * Format: "26 Oct 2025 at 4:51 PM"
 * @param date Date string or Date object
 * @returns Formatted date string in IST
 */
export function formatDateTimeIST(date: string | Date | null | undefined): string {
  if (!date) return "N/A";

  try {
    let dateObj: Date;

    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else {
      dateObj = date;
    }

    if (isNaN(dateObj.getTime())) {
      return "N/A";
    }

    // Format in IST timezone
    return dateObj.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  } catch (error) {
    console.error("Error formatting date:", date, error);
    return "N/A";
  }
}

/**
 * Format date only (without time) in IST
 * Format: "26 Oct 2025"
 * @param date Date string or Date object
 * @returns Formatted date string in IST
 */
export function formatDateOnlyIST(date: string | Date | null | undefined): string {
  if (!date) return "N/A";

  try {
    let dateObj: Date;

    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else {
      dateObj = date;
    }

    if (isNaN(dateObj.getTime())) {
      return "N/A";
    }

    // Format in IST timezone
    return dateObj.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      weekday: "short"
    });
  } catch (error) {
    console.error("Error formatting date:", date, error);
    return "N/A";
  }
}
