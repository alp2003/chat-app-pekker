import '@testing-library/jest-dom'

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveClass(className: string): R;
      toBeVisible(): R;
      toBeDisabled(): R;
      toBeEnabled(): R;
      toHaveValue(value: string | number): R;
      toHaveAttribute(attribute: string, value?: string): R;
      toBeChecked(): R;
      toHaveFocus(): R;
      toHaveTextContent(text: string | RegExp): R;
      toBeEmptyDOMElement(): R;
      toBeInvalid(): R;
      toBeValid(): R;
      toBeRequired(): R;
    }
  }
}
