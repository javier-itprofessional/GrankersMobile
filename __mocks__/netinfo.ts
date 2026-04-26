export default {
  fetch: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
  addEventListener: jest.fn().mockReturnValue(() => {}),
};
