const nanolru = require('nanolru')

class ObjectCache {
  constructor(size = 100) {
    this.cache = nanolru(size)
  }

  get(id, Constructor, ...args) {
    const key = Constructor.name + ':' + id
    let instance = this.cache.get(key)
    if (instance == null) {
      instance = new Constructor(...args)
      this.cache.set(key, instance)
    }
    return instance
  }
}

module.exports = ObjectCache
