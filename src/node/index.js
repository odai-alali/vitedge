import './polyfill.js'
import { createLocalFetch, handleApiRequest } from './api.js'
import { getPageProps } from './props.js'
import { getEventType, nodeToFetchRequest } from './utils.js'

export { getEventType }
export { cors } from '../utils/cors.js'

export async function handleEvent(
  { functions, router, url, manifest, preload = true },
  event = {}
) {
  const type = getEventType({ url, functions })

  if (event.request && !event.request.clone) {
    // Convert to Fetch Request for consistency
    event.rawRequest = event.rawRequest || event.request
    event.request = await nodeToFetchRequest(event.request)
  }

  globalThis.fetch = createLocalFetch({ url, functions })

  if (type === 'api') {
    return handleApiRequest({ url, functions }, event)
  }

  // From here, only GET method is supported
  const method = event.method || event.httpMethod || 'GET'
  if (method !== 'GET' || url.pathname.includes('favicon.ico')) {
    return { statusCode: 404 }
  }

  const { data: pageProps, options: propsOptions = {} } = await getPageProps(
    { functions, router, url },
    event
  )

  let status = propsOptions.status
  const isRedirect = status >= 300 && status < 400
  // This handles SPA page props requests from the browser
  if (type === 'props' || isRedirect) {
    // Mock status when this is a props request to bypass Fetch opaque responses
    status = type === 'props' && isRedirect ? 299 : status

    return {
      statusCode: status,
      statusMessage: propsOptions.statusText,
      ...propsOptions,
      status,
      body: JSON.stringify(pageProps || {}),
    }
  }

  // If it didn't match anything else up to here, fallback to HTML rendering
  const {
    html: body,
    status: statusCode = 200,
    statusText: statusMessage,
    headers,
    ...extra
  } = await router.render(url, {
    ...event,
    initialState: pageProps,
    propsStatusCode: propsOptions.status,
    manifest,
    preload,
  })

  return { body, statusCode, statusMessage, headers, extra }
}
