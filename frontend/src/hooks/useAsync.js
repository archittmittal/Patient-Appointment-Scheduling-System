import { useState, useCallback, useEffect } from 'react';

/**
 * Custom hook to handle asynchronous operations.
 * Reduces boilerplate for loading, error, and data states.
 * 
 * @param {Function} asyncFunction - The async function to execute.
 * @param {boolean} immediate - Whether to execute the function immediately.
 */
export function useAsync(asyncFunction, immediate = true) {
    const [status, setStatus] = useState('idle');
    const [value, setValue] = useState(null);
    const [error, setError] = useState(null);

    // The execute function wraps asyncFunction and
    // handles setting state for pending, value, and error.
    // useCallback ensures the below useEffect is not 
    // triggered on every render.
    const execute = useCallback((...args) => {
        setStatus('pending');
        setValue(null);
        setError(null);

        return asyncFunction(...args)
            .then((response) => {
                setValue(response);
                setStatus('success');
                return response;
            })
            .catch((error) => {
                setError(error);
                setStatus('error');
                throw error;
            });
    }, [asyncFunction]);

    // If immediate is true, run execute on mount
    useEffect(() => {
        if (immediate) {
            execute();
        }
    }, [execute, immediate]);

    return { execute, status, value, error, isLoading: status === 'pending', isSuccess: status === 'success', isError: status === 'error' };
}
