const pages = {
  '/': require('./pages/home.js'),
  'conversation/:url': require('./pages/conversation'),
  '*': require('./pages/notFound.js'),
}

const app = require('choo')()
app.use(require('choo-devtools')())

for (const [route, { view }] of Object.entries(pages)) {
  app.route(route, view)
}

app.use((state, emitter) => {
  let route

  emitter.on('navigate', onnavigate)
  onnavigate()

  function onnavigate() {
    const newRoute = state.route
    if (newRoute !== route) {
      const previousPage = pages[route]
      if (previousPage != null && previousPage.cleanup != null) {
        previousPage.cleanup(state, emitter)
      }
    }
    route = newRoute
    const page = pages[route]
    if (page != null) {
      if (page.store != null) {
        page.store(state, emitter)
      }
    } else {
      console.warn(
        `No page found for route "${route}". You might have a typo in your route. (Note that if you start the route name with / or # it won't match!)`
      )
    }
  }
})

app.mount('main')
