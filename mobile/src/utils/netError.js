// Returns true when the error is a network/connectivity failure (not a server 4xx/5xx)
export const isNetworkErr = (err) =>
  !err.response && (
    err.request ||
    err.code === 'ERR_NETWORK' ||
    err.message === 'Network Error' ||
    err.name === 'NetworkError'
  );
