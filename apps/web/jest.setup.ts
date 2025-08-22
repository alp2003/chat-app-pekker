// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

import '@testing-library/jest-dom'

// Add jest-dom types globally
declare global {
    namespace jest {
        interface Matchers<R> {
            toBeInTheDocument(): R;
        }
    }
}
