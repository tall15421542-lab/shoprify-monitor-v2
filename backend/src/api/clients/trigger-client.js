/**
 * HTTP client for communicating with the trigger API server
 */

/**
 * Get the base URL for the trigger API
 * @returns {string} Trigger API base URL
 */
function getTriggerApiBaseUrl() {
  return process.env.TRIGGER_API_URL || 'http://localhost:3001';
}

/**
 * Make a request to the trigger API
 * @param {string} endpoint - API endpoint path
 * @param {object} options - Fetch options
 * @returns {Promise<object>} Response data
 */
async function triggerApiRequest(endpoint, options = {}) {
  const url = `${getTriggerApiBaseUrl()}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Trigger API request failed: ${error.message}`);
    throw error;
  }
}

/**
 * Trigger polling for a specific store
 * @param {string} storeId - Store ID to poll
 * @returns {Promise<object>} Response data
 */
export async function triggerStorePoll(storeId) {
  return triggerApiRequest(`/poll/store/${storeId}`, {
    method: 'POST',
  });
}

/**
 * Trigger polling for all active stores
 * @returns {Promise<object>} Response data
 */
export async function triggerAllStoresPoll() {
  return triggerApiRequest('/poll/all', {
    method: 'POST',
  });
}

/**
 * Trigger aggregation for a specific time window
 * @param {object} params - Aggregation parameters
 * @returns {Promise<object>} Response data
 */
export async function triggerAggregation(params) {
  return triggerApiRequest('/aggregate', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Trigger aggregation for current hour
 * @returns {Promise<object>} Response data
 */
export async function triggerCurrentHourAggregation() {
  return triggerApiRequest('/aggregate/current', {
    method: 'POST',
  });
}

