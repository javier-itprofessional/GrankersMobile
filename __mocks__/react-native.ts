export const AppState = {
  currentState: 'active' as string,
  addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
};

export const Alert = {
  alert: jest.fn(),
};
