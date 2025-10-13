import { forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import { DateValue } from 'react-aria-components';
import './DateRange.css';
import MyDatePicker from './MyDatePicker';
import { parseNumericFiltersForDates, calendarDatesAreEqual } from '../utils/formatters';

interface DateRangeProps {
    onDateRangeChange?: (startDate: Date | undefined, endDate: Date | undefined) => void;
    selectedNumericFilters: string[];
}

export interface DateRangeRef {
    reset: () => void;
}

const DateRange = forwardRef<DateRangeRef, DateRangeProps>(({ onDateRangeChange, selectedNumericFilters }, ref) => {
    const [startDate, setStartDate] = useState<DateValue | null>(null);
    const [endDate, setEndDate] = useState<DateValue | null>(null);

    // Parse selectedNumericFilters to set start and end dates
    useEffect(() => {
        if (selectedNumericFilters.length > 0) {
            const { startDate: parsedStartDate, endDate: parsedEndDate } = parseNumericFiltersForDates(selectedNumericFilters);

            // Only update if we found valid dates and they're different from current state
            if (parsedStartDate && !calendarDatesAreEqual(parsedStartDate, startDate)) {
                setStartDate(parsedStartDate);
            }

            if (parsedEndDate && !calendarDatesAreEqual(parsedEndDate, endDate)) {
                setEndDate(parsedEndDate);
            }
        }
    }, [selectedNumericFilters, startDate, endDate, onDateRangeChange]);

    const handleChangeStartDate = (date: DateValue | null) => {
        setStartDate(date);

        // Convert DateValue to Date and call callback
        if (onDateRangeChange) {
            const startJSDate = date ? new Date(date.year, date.month - 1, date.day) : undefined;
            const endJSDate = endDate ? new Date(endDate.year, endDate.month - 1, endDate.day) : undefined;
            onDateRangeChange(startJSDate, endJSDate);
        }
    };

    const handleChangeEndDate = (date: DateValue | null) => {
        setEndDate(date);

        // Convert DateValue to Date and call callback
        if (onDateRangeChange) {
            const startJSDate = startDate ? new Date(startDate.year, startDate.month - 1, startDate.day) : undefined;
            const endJSDate = date ? new Date(date.year, date.month - 1, date.day) : undefined;
            onDateRangeChange(startJSDate, endJSDate);
        }
    };

    const handleClearStartDate = () => {
        setStartDate(null);
        if (onDateRangeChange) {
            const endJSDate = endDate ? new Date(endDate.year, endDate.month - 1, endDate.day) : undefined;
            onDateRangeChange(undefined, endJSDate);
        }
    };

    const handleClearEndDate = () => {
        setEndDate(null);
        if (onDateRangeChange) {
            const startJSDate = startDate ? new Date(startDate.year, startDate.month - 1, startDate.day) : undefined;
            onDateRangeChange(startJSDate, undefined);
        }
    };

    useImperativeHandle(ref, () => ({
        reset: () => {
            setStartDate(null);
            setEndDate(null);
        }
    }));

    return (
        <div className="date-range-filter">
            <div className="date-range-wrapper">
                <div className="date-range-inputs">
                    <div className={`date-range-input-wrapper ${selectedNumericFilters.length > 0 && startDate ? 'has-value' : ''}`}>
                        <MyDatePicker<DateValue>
                            value={startDate}
                            onChange={handleChangeStartDate}
                            label="From"
                            aria-label="From date"
                            showClearButton={!!startDate}
                            onClear={handleClearStartDate}
                        />
                    </div>

                    <div className={`date-range-input-wrapper ${selectedNumericFilters.length > 0 && endDate ? 'has-value' : ''}`}>
                        <MyDatePicker<DateValue>
                            value={endDate}
                            onChange={handleChangeEndDate}
                            label="To"
                            aria-label="To date"
                            showClearButton={!!endDate}
                            onClear={handleClearEndDate}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
});

DateRange.displayName = 'DateRange';

export default DateRange;