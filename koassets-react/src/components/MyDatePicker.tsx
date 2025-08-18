import type { DatePickerProps, DateValue, ValidationResult } from 'react-aria-components';
import { Button, Calendar, CalendarCell, CalendarGrid, DateInput, DatePicker, DateSegment, Dialog, FieldError, Group, Heading, Popover, Text } from 'react-aria-components';
import './MyDatePicker.css';

interface MyDatePickerProps<T extends DateValue> extends DatePickerProps<T> {
    label?: string;
    description?: string;
    errorMessage?: string | ((validation: ValidationResult) => string);
}

export default function MyDatePicker<T extends DateValue>(
    { label, description, errorMessage, ...props }:
        MyDatePickerProps<T>
) {
    return (
        <DatePicker {...props} className="my-date-picker">
            {/* <Label>{label}</Label> */}
            <Group>
                <DateInput>
                    {(segment) => <DateSegment segment={segment} />}
                </DateInput>
                <Button>
                    ▼
                </Button>
            </Group>
            {description && <Text slot="description">{description}</Text>}
            <FieldError>{errorMessage}</FieldError>
            <Popover>
                <Dialog>
                    <Calendar>
                        <header>
                            <Button slot="previous">
                                ◀
                            </Button>
                            <Heading />
                            <Button slot="next">
                                ▶
                            </Button>
                        </header>
                        <CalendarGrid>
                            {(date) => <CalendarCell date={date} />}
                        </CalendarGrid>
                    </Calendar>
                </Dialog>
            </Popover>
        </DatePicker>
    );
}