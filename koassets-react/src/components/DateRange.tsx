import { forwardRef, useImperativeHandle, useState } from 'react';
import { DateValue } from 'react-aria-components';
import './DateRange.css';
import MyDatePicker from './MyDatePicker';

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

    const handleStartDateChange = (date: DateValue | null) => {
        setStartDate(date);

        // Convert DateValue to Date and call callback
        if (onDateRangeChange) {
            const startJSDate = date ? new Date(date.year, date.month - 1, date.day) : undefined;
            const endJSDate = endDate ? new Date(endDate.year, endDate.month - 1, endDate.day) : undefined;
            onDateRangeChange(startJSDate, endJSDate);
        }
    };

    const handleEndDateChange = (date: DateValue | null) => {
        setEndDate(date);

        // Convert DateValue to Date and call callback
        if (onDateRangeChange) {
            const startJSDate = startDate ? new Date(startDate.year, startDate.month - 1, startDate.day) : undefined;
            const endJSDate = date ? new Date(date.year, date.month - 1, date.day) : undefined;
            onDateRangeChange(startJSDate, endJSDate);
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
                            onChange={handleStartDateChange}
                            label="From"
                            aria-label="From date"
                        />
                    </div>

                    <div className={`date-range-input-wrapper ${selectedNumericFilters.length > 0 && endDate ? 'has-value' : ''}`}>
                        <MyDatePicker<DateValue>
                            value={endDate}
                            onChange={handleEndDateChange}
                            label="To"
                            aria-label="To date"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
});

DateRange.displayName = 'DateRange';

export default DateRange;