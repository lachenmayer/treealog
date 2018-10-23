class ObjectCache {
  constructor() {
    this.cache = {}
  }

  get(id, Constructor, ...args) {
    const key = Constructor.name + ':' + id
    let instance = this.cache[key]
    if (instance == null) {
      instance = new Constructor(...args)
      this.cache[key] = instance
    }
    return instance
  }
}

module.exports = ObjectCache
