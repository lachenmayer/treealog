const app = require('choo')()
app.use(require('choo-devtools')())

app.route('/', require('./routes/home'))
app.route('conversation/:url', require('./routes/conversation'))
app.route('*', require('./routes/notFound'))

app.use(require('./stores/conversations'))

app.mount('main')
