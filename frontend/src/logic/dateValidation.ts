import { useConfirm } from 'material-ui-confirm';
import dayjs from 'dayjs';

/**
 * Hook that returns a date validation function.
 * Criteria: Date is not in the current month OR date is more than 7 days in the past.
 * Returns a promise that resolves to true if valid/confirmed, or false if cancelled.
 */
export const useDateValidation = () => {
    const confirm = useConfirm();

    return async (date: string): Promise<boolean> => {
        const entryDate = dayjs(date);
        const today = dayjs();

        // Check if not in the same month (month and year must match)
        const differentMonth = entryDate.month() !== today.month() || entryDate.year() !== today.year();

        // Check if past 7 days (exclusive of today)
        const pastSevenDays = entryDate.isBefore(today.subtract(7, 'day'), 'day');

        if (differentMonth || pastSevenDays) {
            const reasons = [];
            if (differentMonth) reasons.push("not in the current month");
            if (pastSevenDays) reasons.push("more than 7 days in the past");

            try {
                let response = await confirm({
                    title: 'Confirm Backdated Entry',
                    description: `The date entered (${entryDate.format('MMM DD, YYYY')}) is ${reasons.join(' and ')}. Do you want to continue?`,
                    confirmationText: 'Yes, Proceed',
                    cancellationText: 'Go Back',
                    confirmationButtonProps: { color: 'warning', variant: 'contained' },
                });
                if(!response.confirmed){
                    return false;
                }
                return true;
            } catch (e) {
                return false;
            }
        }

        return true;
    };
};
