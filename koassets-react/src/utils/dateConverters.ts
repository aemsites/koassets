/**
 * Date conversion utilities for React components
 */

import { CalendarDate } from '@internationalized/date';

/**
 * Converts a CalendarDate object to ISO date string (YYYY-MM-DD)
 * @param calendarDate - CalendarDate object from @internationalized/date
 * @returns ISO formatted date string (YYYY-MM-DD) or null if input is invalid
 */
export const calendarDateToISO = (calendarDate: CalendarDate | null | undefined): string | null => {
  if (!calendarDate) return null;
  
  const year = calendarDate.year;
  const month = String(calendarDate.month).padStart(2, '0');
  const day = String(calendarDate.day).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

