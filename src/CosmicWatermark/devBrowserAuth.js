// Standalone compatibility shim for the component copied from Apollo.
export const isAutomatedBrowserSession = () =>
  typeof navigator !== 'undefined' && navigator.webdriver === true;
