import dayjs from 'dayjs';

/**
 * Validates if the given date requires a confirmation message.
 * Criteria: Date is not in the current month OR date is more than 7 days in the past.
 * Returns true if valid/confirmed, false if cancelled.
 */
export const validateEntryDate = (date: string): boolean => {
    const entryDate = dayjs(date);
    const today = dayjs();

    // Check if not in the same month (month and year must match)
    const differentMonth = entryDate.month() !== today.month() || entryDate.year() !== today.year();

    // Check if past 7 days (exclusive of today)
    // .subtract(7, 'day') gives the date 7 days ago. 
    // .isBefore(today.subtract(7, 'day'), 'day') means 8+ days ago.
    const pastSevenDays = entryDate.isBefore(today.subtract(7, 'day'), 'day');

    if (differentMonth || pastSevenDays) {
        const reasons = [];
        if (differentMonth) reasons.push("not in the current month");
        if (pastSevenDays) reasons.push("more than 7 days in the past");

        const message = `The date entered (${entryDate.format('MMM DD, YYYY')}) is ${reasons.join(' and ')}. Are you sure you want to proceed?`;
        return window.confirm(message);
    }

    return true;
};
